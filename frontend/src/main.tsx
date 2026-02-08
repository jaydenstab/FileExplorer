// import { createRoot } from "react-dom/client";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// import App from "./App.tsx";
// import { ThemeProvider } from "./components/theme-provider";

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 1000 * 60 * 5, // 5 minutes
//       refetchOnWindowFocus: false,
//     },
//   },
// });

// createRoot(document.getElementById("root")!).render(
//   <QueryClientProvider client={queryClient}>
//     <ThemeProvider defaultTheme="dark" storageKey="file-explorer-theme">
//       <App />
//     </ThemeProvider>
//     {import.meta.env.MODE === 'development' && (
//       <ReactQueryDevtools initialIsOpen={false} />
//     )}
//   </QueryClientProvider>
// );

import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
