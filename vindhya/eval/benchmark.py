"""
Vindhya Context Pruning Benchmark
===================================
Demonstrates token reduction, cost savings, and latency improvement
of Context-Pruned RAG vs Baseline RAG.

Usage:
  python eval/benchmark.py --api http://localhost:8000 --token YOUR_JWT --textbook_id 1

Requirements: pip install httpx rich tabulate
"""
import argparse
import asyncio
import statistics
import time
import httpx
from rich.console import Console
from rich.table import Table
from rich import print as rprint

console = Console()

TEST_QUERIES = [
    "What is Newton's First Law of Motion?",
    "Explain photosynthesis",
    "What causes seasons on Earth?",
    "Describe the water cycle",
    "What is the difference between acids and bases?",
    "Explain Ohm's law",
    "What is DNA and what does it do?",
    "Describe the structure of an atom",
    "What is the greenhouse effect?",
    "Explain the process of osmosis",
]


async def run_query(client: httpx.AsyncClient, query: str, textbook_id: int, use_pruning: bool) -> dict:
    t0 = time.perf_counter()
    resp = await client.post(
        "/api/ask/",
        json={"query": query, "textbook_id": textbook_id, "use_pruning": use_pruning},
        timeout=60.0,
    )
    wall_ms = (time.perf_counter() - t0) * 1000

    if resp.status_code != 200:
        return {"error": resp.text, "query": query}

    data = resp.json()
    stats = data.get("stats", {})
    return {
        "query": query,
        "baseline_tokens": stats.get("baseline_tokens", 0),
        "pruned_tokens": stats.get("pruned_tokens", 0),
        "tokens_saved": stats.get("tokens_saved", 0),
        "reduction_pct": stats.get("reduction_pct", 0),
        "cost_baseline": stats.get("cost_baseline_usd", 0),
        "cost_pruned": stats.get("cost_pruned_usd", 0),
        "latency_ms": stats.get("latency_ms", wall_ms),
        "from_cache": data.get("from_cache", False),
    }


async def benchmark(api_url: str, token: str, textbook_id: int, queries: list):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url=api_url, headers=headers) as client:
        # Verify connection
        try:
            health = await client.get("/api/health")
            console.print(f"[green]✓ Connected to Vindhya API — model: {health.json()['model']}[/green]")
        except Exception as e:
            console.print(f"[red]✗ Cannot connect to {api_url}: {e}[/red]")
            return

        console.print(f"\n[bold cyan]Running benchmark on {len(queries)} queries...[/bold cyan]\n")

        results = []
        for i, q in enumerate(queries):
            console.print(f"[dim]  [{i+1}/{len(queries)}] {q[:60]}...[/dim]", end="")
            try:
                # Run pruned query (includes baseline token count for comparison)
                r = await run_query(client, q, textbook_id, use_pruning=True)
                results.append(r)
                pct = r.get("reduction_pct", 0)
                console.print(f" [green]✓ -{pct}%[/green]")
            except Exception as e:
                console.print(f" [red]✗ {e}[/red]")

            await asyncio.sleep(0.5)  # be nice to the API

        return results


def print_report(results: list):
    if not results:
        console.print("[red]No results to report[/red]")
        return

    valid = [r for r in results if "error" not in r]
    if not valid:
        console.print("[red]All queries failed[/red]")
        return

    # Summary stats
    avg_baseline = statistics.mean(r["baseline_tokens"] for r in valid)
    avg_pruned = statistics.mean(r["pruned_tokens"] for r in valid)
    avg_reduction = statistics.mean(r["reduction_pct"] for r in valid)
    total_saved_tok = sum(r["tokens_saved"] for r in valid)
    total_cost_baseline = sum(r["cost_baseline"] for r in valid)
    total_cost_pruned = sum(r["cost_pruned"] for r in valid)
    avg_latency = statistics.mean(r["latency_ms"] for r in valid)
    cost_saved_pct = (1 - total_cost_pruned / total_cost_baseline) * 100 if total_cost_baseline > 0 else 0

    # Per-query table
    table = Table(title="Context Pruning Results", style="cyan", header_style="bold magenta")
    table.add_column("Query", style="white", max_width=35)
    table.add_column("Baseline Tok", justify="right", style="red")
    table.add_column("Pruned Tok", justify="right", style="green")
    table.add_column("Saved", justify="right", style="yellow")
    table.add_column("Reduction", justify="right", style="bold green")
    table.add_column("Latency", justify="right", style="dim")

    for r in valid:
        table.add_row(
            r["query"][:35] + ("..." if len(r["query"]) > 35 else ""),
            str(r["baseline_tokens"]),
            str(r["pruned_tokens"]),
            str(r["tokens_saved"]),
            f"{r['reduction_pct']:.1f}%",
            f"{r['latency_ms']:.0f}ms",
        )

    console.print(table)

    # Summary
    console.print("\n[bold]═══ Benchmark Summary ════════════════════════════════════[/bold]")
    console.print(f"  Queries tested         : {len(valid)}")
    console.print(f"  Avg baseline context   : [red]{avg_baseline:.0f}[/red] tokens")
    console.print(f"  Avg pruned context     : [green]{avg_pruned:.0f}[/green] tokens")
    console.print(f"  Avg token reduction    : [bold green]{avg_reduction:.1f}%[/bold green]")
    console.print(f"  Total tokens saved     : [yellow]{total_saved_tok:,}[/yellow]")
    console.print(f"  Baseline total cost    : [red]${total_cost_baseline:.6f}[/red]")
    console.print(f"  Pruned total cost      : [green]${total_cost_pruned:.6f}[/green]")
    console.print(f"  Cost savings           : [bold green]{cost_saved_pct:.1f}%[/bold green] (${total_cost_baseline - total_cost_pruned:.6f} saved)")
    console.print(f"  Avg query latency      : {avg_latency:.0f}ms")
    console.print("\n  [bold cyan]Estimated annual savings (100 queries/day):[/bold cyan]")
    daily_savings = (total_cost_baseline - total_cost_pruned) / len(valid) * 100
    console.print(f"    Daily  : ${daily_savings:.4f}")
    console.print(f"    Monthly: ${daily_savings * 30:.2f}")
    console.print(f"    Annual : [bold yellow]${daily_savings * 365:.2f}[/bold yellow]")
    console.print()


async def main():
    parser = argparse.ArgumentParser(description="Vindhya Context Pruning Benchmark")
    parser.add_argument("--api", default="http://localhost:8000", help="API URL")
    parser.add_argument("--token", required=True, help="JWT token from login")
    parser.add_argument("--textbook_id", type=int, required=True, help="Textbook ID to test against")
    parser.add_argument("--queries", nargs="+", default=None, help="Custom queries (optional)")
    args = parser.parse_args()

    queries = args.queries or TEST_QUERIES
    results = await benchmark(args.api, args.token, args.textbook_id, queries)
    if results:
        print_report(results)


if __name__ == "__main__":
    asyncio.run(main())
