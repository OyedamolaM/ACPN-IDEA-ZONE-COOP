import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import { initialFinance, type FinanceState } from "./finance";
import { initialLoans, initialTreasury, type Loan, type Treasury } from "./loans";

type Store = {
  state: FinanceState;
  setState: Dispatch<SetStateAction<FinanceState>>;
  loans: Loan[];
  setLoans: Dispatch<SetStateAction<Loan[]>>;
  treasury: Treasury;
  setTreasury: Dispatch<SetStateAction<Treasury>>;
};
const Ctx = createContext<Store | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialFinance);
  const [loans, setLoans] = useState(initialLoans);
  const [treasury, setTreasury] = useState(initialTreasury);
  return (
    <Ctx.Provider value={{ state, setState, loans, setLoans, treasury, setTreasury }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
