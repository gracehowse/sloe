/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DmcaTakedownForm } from "../../app/dmca/_form/DmcaTakedownForm";

describe("DmcaTakedownForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all required fields", () => {
    render(<DmcaTakedownForm />);
    expect(screen.getByLabelText(/Your email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Original post URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sloe recipe ID or link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit takedown request/i })).toBeInTheDocument();
  });

  it("submits the form payload to /api/dmca-takedown and renders success message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, message: "Submission received." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DmcaTakedownForm />);
    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: "creator@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Original post URL/i), {
      target: { value: "https://www.instagram.com/p/ABC/" },
    });
    fireEvent.change(screen.getByLabelText(/Sloe recipe ID or link/i), {
      target: { value: "https://suppr-club.com/recipe/abc" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Please remove this." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit takedown request/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Submission received."),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dmca-takedown",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const sentBody = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as Record<string, unknown>;
    expect(sentBody).toEqual({
      reporterEmail: "creator@example.com",
      originalPostUrl: "https://www.instagram.com/p/ABC/",
      supprRecipeId: "https://suppr-club.com/recipe/abc",
      description: "Please remove this.",
    });
  });

  it("renders an error message when the server rejects the submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: false,
        error: "invalid_input",
        field: "reporterEmail",
        message: "Enter a valid email address.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DmcaTakedownForm />);
    // Use values that pass HTML5 validation but server rejects
    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: "ok@x.y" },
    });
    fireEvent.change(screen.getByLabelText(/Original post URL/i), {
      target: { value: "https://www.instagram.com/p/ABC/" },
    });
    fireEvent.change(screen.getByLabelText(/Sloe recipe ID or link/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit takedown request/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Enter a valid email address/i),
    );
    expect(screen.getByLabelText(/Your email/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("renders a network-error fallback when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    render(<DmcaTakedownForm />);
    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: "ok@x.y" },
    });
    fireEvent.change(screen.getByLabelText(/Original post URL/i), {
      target: { value: "https://www.instagram.com/p/ABC/" },
    });
    fireEvent.change(screen.getByLabelText(/Sloe recipe ID or link/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit takedown request/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/email dmca@getsloe.com/i),
    );
  });

  it("disables the submit button while submitting", async () => {
    let resolveFetch!: (value: { json: () => Promise<unknown> }) => void;
    const pending = new Promise<{ json: () => Promise<unknown> }>((r) => {
      resolveFetch = r;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<DmcaTakedownForm />);
    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: "ok@x.y" },
    });
    fireEvent.change(screen.getByLabelText(/Original post URL/i), {
      target: { value: "https://www.instagram.com/p/ABC/" },
    });
    fireEvent.change(screen.getByLabelText(/Sloe recipe ID or link/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit takedown request/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submitting/ })).toBeDisabled();
    });

    resolveFetch({ json: async () => ({ ok: true, message: "ok" }) });
  });
});
