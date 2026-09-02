/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider, Meta } from "@solidjs/meta";
import { Suspense, lazy } from "solid-js";
import { getAppBasePath } from "~/utils/appBase";
import "./root.css";
import "./app.css";
import "./styles/fonts.css";

const root = document.getElementById("root");
const routerBase = getAppBasePath();

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
          <Route
            path="/predictions"
            component={lazy(() => import("./routes/predictions"))}
          />
          <Route
            path="/predictions/"
            component={lazy(() => import("./routes/predictions"))}
          />
          <Route
            path="/status"
            component={lazy(() => import("./routes/status"))}
          />
          <Route
            path="/status/"
            component={lazy(() => import("./routes/status"))}
          />
          <Route
            path="/rtestatus"
            component={lazy(() => import("./routes/rtestatus"))}
          />
          <Route
            path="/rtestatus/"
            component={lazy(() => import("./routes/rtestatus"))}
          />
          <Route
            path="/dev/messages"
            component={lazy(() => import("./routes/dev/messages"))}
          />
          <Route path="*" component={lazy(() => import("./routes/[...404]"))} />
        </Suspense>
      </Router>
    </MetaProvider>
  ),
  root!,
);
