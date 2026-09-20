/**
 * _authenticated — pathless layout route that wraps every authenticated
 * page in the SINGLE global `MainDashboardShell`.
 *
 * Child routes (e.g. /home, /farmer, /farmer/prices, /chatbot, /coordinator/...)
 * render inside this layout. They MUST NOT render their own global header,
 * brand row, sign-out button, language switcher or notifications bell —
 * those are provided once by the shell above the Outlet.
 */

import { createFileRoute } from "@tanstack/react-router";
import { MainDashboardShell } from "@/components/MainDashboardShell";

export const Route = createFileRoute("/_authenticated")({
  component: MainDashboardShell,
});
