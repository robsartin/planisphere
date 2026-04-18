/* SPDX-License-Identifier: Apache-2.0 */
import "cesium/Build/Cesium/Widgets/widgets.css";
import { bootstrap } from "./app";

void bootstrap(document.getElementById("app"));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
