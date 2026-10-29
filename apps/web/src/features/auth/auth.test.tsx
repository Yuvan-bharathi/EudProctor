import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireRole, RoleRedirect } from "./RequireRole";
import { authStore, type Role } from "./store";

function login(role: Role) {
  authStore.set({
    access_token: "a",
    refresh_token: "r",
    user: { id: "1", role, email: `${role}@example.com`, name: role, is_active: true },
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/mentor" element={<RequireRole roles={["mentor"]}>mentor home</RequireRole>} />
        <Route path="/candidate" element={<RequireRole roles={["candidate"]}>candidate home</RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={["admin"]}>admin home</RequireRole>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => authStore.clear());

describe("role-based redirect", () => {
  it("sends anonymous users to login", () => {
    renderAt("/mentor");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it.each([
    ["mentor", "mentor home"],
    ["candidate", "candidate home"],
    ["admin", "admin home"],
  ] as const)("redirects %s to their home", (role, text) => {
    login(role);
    renderAt("/");
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("keeps a candidate out of mentor pages", () => {
    login("candidate");
    renderAt("/mentor");
    expect(screen.getByText("candidate home")).toBeInTheDocument();
  });
});
