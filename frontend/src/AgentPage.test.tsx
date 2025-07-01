import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AgentPage from "./AgentPage";

beforeEach(() => {
  (global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
});

test("auto resumes from localStorage", async () => {
  localStorage.setItem("sessionId", "abc");
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        threadId: "abc",
        workflow_type: "meal_planning",
        current_step: "planning",
        message: "hi",
        raw: { meal_plan: { days: [] } },
      }),
  });

  render(<AgentPage />);

  // Wait for the Start Session button to appear after auto-resume
  await waitFor(() =>
    expect(screen.getByTestId("start-session")).toBeInTheDocument()
  );
});

test("clears completed session from storage", async () => {
  localStorage.setItem("sessionId", "done");
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        threadId: "done",
        workflow_type: "meal_planning",
        current_step: "complete",
      }),
  });

  render(<AgentPage />);

  await waitFor(() =>
    expect(screen.getByTestId("start-session")).toBeInTheDocument()
  );
  expect(localStorage.getItem("sessionId")).toBeNull();
});

test("copies meal plan to clipboard", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        threadId: "123",
        currentStep: "started",
        message: "hi",
        initialState: {
          meal_plan: {
            days: [
              {
                dayIndex: 0,
                mealType: "breakfast",
                meal: { id: 1, name: "Eggs", effort: 1 },
              },
            ],
          },
        },
      }),
  });

  const write = jest.fn();
  Object.assign(navigator, { clipboard: { write, writeText: write } });
  // Mock ClipboardItem constructor
  (global as any).ClipboardItem = jest
    .fn()
    .mockImplementation((data) => ({ data }));

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));

  await waitFor(() =>
    expect(screen.getByTestId("meal-plan-table")).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByTestId("copy-meal-plan"));
  expect(write).toHaveBeenCalled();
});

test("copies shopping list to clipboard", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        threadId: "123",
        currentStep: "started",
        message: "hi",
        raw: {
          meal_plan: { days: [] },
          shopping_list: [{ ingredient: "eggs", quantity: "1" }],
        },
      }),
  });

  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));

  await waitFor(() =>
    expect(screen.getByTestId("copy-shopping-list")).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByTestId("copy-shopping-list"));
  expect(writeText).toHaveBeenCalledWith("- 1 eggs");
});

test("starts a new session", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        threadId: "123",
        currentStep: "started",
        message: "hi",
        initialState: {
          meal_plan: {
            days: [
              {
                dayIndex: 0,
                mealType: "breakfast",
                meal: { id: 1, name: "Eggs", effort: 1 },
              },
            ],
          },
        },
      }),
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/agent/start",
      expect.any(Object),
    );
    expect(screen.getByTestId("meal-plan-table")).toBeInTheDocument();
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });
});

test("sends a message in an existing session", async () => {
  // Mock start session response
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ threadId: "123", currentStep: "started" }),
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));
  await waitFor(() =>
    expect(screen.getByTestId("message-input")).toBeInTheDocument()
  );

  // Mock message send and response
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ message: "ok", raw: { meal_plan: { days: [] } } }),
  });

  fireEvent.change(screen.getByTestId("message-input"), {
    target: { value: "hello" },
  });
  fireEvent.click(screen.getByTestId("send-button"));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
});

test("pressing Enter sends the message", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ threadId: "123", currentStep: "started" }),
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));
  await waitFor(() =>
    expect(screen.getByTestId("message-input")).toBeInTheDocument(),
  );

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({}),
  });
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({ message: "ok", raw: { meal_plan: { days: [] } } }),
  });

  fireEvent.change(screen.getByTestId("message-input"), {
    target: { value: "hello" },
  });
  fireEvent.keyPress(screen.getByTestId("message-input"), {
    key: "Enter",
    code: "Enter",
    charCode: 13,
  });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
});

test("highlights changed meal plan entries", async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        threadId: "123",
        currentStep: "started",
        initialState: {
          meal_plan: {
            days: [
              {
                dayIndex: 0,
                mealType: "breakfast",
                meal: { id: 1, name: "Eggs", effort: 1 },
              },
            ],
          },
        },
      }),
  });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));

  await waitFor(() =>
    expect(screen.getByTestId("meal-plan-table")).toBeInTheDocument(),
  );

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({}),
  });
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        message: "ok",
        meal_plan: {
          days: [
            {
              dayIndex: 0,
              mealType: "breakfast",
              meal: { id: 2, name: "Pancakes", effort: 1 },
            },
          ],
        },
      }),
  });

  fireEvent.change(screen.getByTestId("message-input"), {
    target: { value: "change" },
  });
  fireEvent.click(screen.getByTestId("send-button"));

  await waitFor(() => {
    expect(screen.getByTestId("meal-0-breakfast")).toBeInTheDocument();
  });
});

test("shows typing indicator when agent is working", async () => {
  let resolvePromise: (value: any) => void;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  (global.fetch as jest.Mock).mockReturnValueOnce({
    json: () => promise,
  });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));

  // Check that typing indicator appears when working
  await waitFor(() => {
    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
  });

  // Resolve the promise to complete the request
  resolvePromise!({
    threadId: "123",
    currentStep: "started",
    message: "Ready",
  });

  // Wait for typing indicator to disappear
  await waitFor(() => {
    expect(screen.queryByTestId("typing-indicator")).not.toBeInTheDocument();
  });
});

test("startNewSession abandons existing workflow", async () => {
  localStorage.setItem("sessionId", "old");
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ threadId: "old", current_step: "planning" }),
    }) // initial resume check
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ABANDONED" }),
    }) // abandon
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ threadId: "new", currentStep: "started" }),
    });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId("start-session"));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/workflows/old");
  expect(global.fetch).toHaveBeenNthCalledWith(
    2,
    "/api/workflows/old/abandon",
    expect.objectContaining({ method: "POST" }),
  );
  expect(global.fetch).toHaveBeenNthCalledWith(
    3,
    "/api/agent/start",
    expect.any(Object),
  );
  expect(localStorage.getItem("sessionId")).toBe("new");
});
