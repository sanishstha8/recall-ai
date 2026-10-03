import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { renderWithProviders } from "@/tests/test-utils";

const replace = vi.fn();
const login = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=/dashboard/chat"),
}));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: () => ({ login, status: "anonymous" }) }));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

describe("Login", () => {
  beforeEach(() => {
    replace.mockReset();
    login.mockReset();
  });

  it("validates inputs before calling the API", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in and redirects to the requested page", async () => {
    login.mockResolvedValue({ id: 1, email: "a@b.co" });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/chat"));
    expect(login).toHaveBeenCalledWith("a@b.co", "secret-pass");
  });

  it("shows the server error message", async () => {
    login.mockRejectedValue(new ApiError(401, "authentication_failed", "Invalid email or password."));
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(replace).not.toHaveBeenCalled();
  });
});
