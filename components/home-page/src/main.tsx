import "@patternfly/react-core/dist/styles/base.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "react-intl";

import { createBrowserHomeRuntime } from "./composition/home-composition";
import { englishMessages } from "./i18n/catalog";
import { HomePage } from "./ui/home-page";
import { HomeRuntimeProvider } from "./ui/home-runtime";

// Follow the operating system theme, the same PatternFly dark theme class the
// web console uses.
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () => {
  document.documentElement.classList.toggle(
    "pf-v6-theme-dark",
    darkScheme.matches,
  );
};
applyScheme();
darkScheme.addEventListener("change", applyScheme);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <IntlProvider defaultLocale="en" locale="en" messages={englishMessages}>
      <QueryClientProvider client={new QueryClient()}>
        <HomeRuntimeProvider
          runtime={createBrowserHomeRuntime(document.baseURI)}
        >
          <HomePage fallbackSlackChannel="forum-hypershell" />
        </HomeRuntimeProvider>
      </QueryClientProvider>
    </IntlProvider>
  </StrictMode>,
);
