import { createContext, useContext, type ReactNode } from "react";

import type { HomeApplicationRuntime } from "../application/load-home-content";

const HomeRuntimeContext = createContext<HomeApplicationRuntime | null>(null);

export function HomeRuntimeProvider({
  children,
  runtime,
}: {
  readonly children: ReactNode;
  readonly runtime: HomeApplicationRuntime;
}) {
  return (
    <HomeRuntimeContext.Provider value={runtime}>
      {children}
    </HomeRuntimeContext.Provider>
  );
}

export function useHomeRuntime(): HomeApplicationRuntime {
  const runtime = useContext(HomeRuntimeContext);
  if (!runtime) {
    throw new Error("HomeRuntimeProvider is missing");
  }
  return runtime;
}
