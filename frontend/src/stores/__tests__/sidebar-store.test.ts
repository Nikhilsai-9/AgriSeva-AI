import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "../sidebar-store";

describe("Sidebar Store Tests", () => {
  beforeEach(() => {
    useSidebarStore.getState().setCollapsed(false);
  });

  it("initializes with isCollapsed false by default", () => {
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it("toggles sidebar state from expanded to collapsed and back", () => {
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
    useSidebarStore.getState().toggleSidebar();
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    useSidebarStore.getState().toggleSidebar();
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it("allows setting collapsed explicitly", () => {
    useSidebarStore.getState().setCollapsed(true);
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    useSidebarStore.getState().setCollapsed(false);
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });
});
