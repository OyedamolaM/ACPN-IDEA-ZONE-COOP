<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## App architecture
- Keep this explicitly requested mock application in shared React state; no real authentication, money movement or persistence is implied.
- Keep financial calculations in a pure module using integer minor currency units and BigInt-weighted largest-remainder allocation to prevent rounding loss.
- Derive all balances from append-only balanced ledger transactions, so member and admin views always reflect the same state.
- Treat the member/admin selector as a simulation view switch, never an authorization boundary.

- Loans, guarantor freezes and external borrowing live in the pure `src/lib/loans.ts` module (integer kobo, BigInt interest rounding). The loan book and borrowing log are separate append-style state, not ledger transactions; guarantor freezes are derived from open loans, never stored.
