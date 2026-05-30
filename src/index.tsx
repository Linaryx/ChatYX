/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider, Meta } from "@solidjs/meta";
import { Suspense, lazy } from "solid-js";
import "./root.css";
import "./styles/fonts.css";

const root = document.getElementById("root");
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

render(
  () => (
    <MetaProvider>
      <Meta charset="utf-8" />
      <Meta name="viewport" content="width=device-width, initial-scale=1" />
      <Router base={routerBase}>
        <Suspense>
          <Route path="/" component={lazy(() => import("./routes/setup"))} />
          <Route
            path="/setup"
            component={lazy(() => import("./routes/setup"))}
          />
          <Route
            path="/chat"
            component={lazy(() => import("./routes/chat/channel"))}
          />
          <Route
            path="/chat/"
            component={lazy(() => import("./routes/chat/channel"))}
          />
          <Route path="*" component={lazy(() => import("./routes/[...404]"))} />
        </Suspense>
      </Router>
    </MetaProvider>
  ),
  root!,
);
