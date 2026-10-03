import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FlashcardDeck } from "@/components/study/flashcard-deck";
import { renderWithProviders } from "@/tests/test-utils";
import type { QuizQuestion } from "@/types/api";

const studyApi = vi.hoisted(() => ({ submitAttempt: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ studyApi }));

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Which normal form removes transitive dependencies?",
    options: { A: "1NF", B: "2NF", C: "3NF", D: "BCNF" },
  },
  { id: 2, question: "1NF requires…", options: { A: "atomic values", B: "foreign keys", C: "indexes", D: "views" } },
];

describe("Flashcards", () => {
  it("flips and moves between cards", async () => {
    renderWithProviders(
      <FlashcardDeck
        cards={[
          { id: 1, question: "What is 1NF?", answer: "Atomic values only." },
          { id: 2, question: "What is 2NF?", answer: "No partial dependencies." },
        ]}
      />,
    );
    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    const card = screen.getByTestId("flashcard");
    expect(card).toHaveAccessibleName("Show answer");
    await userEvent.click(card);
    expect(card).toHaveAccessibleName("Show question");
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("What is 2NF?")).toBeInTheDocument();
  });
});

describe("Exam runner", () => {
  it("navigates questions, submits answers and shows the server-scored result", async () => {
    studyApi.submitAttempt.mockResolvedValue({
      id: 1,
      study_set: 4,
      answers: { "1": "C", "2": "B" },
      score: 1,
      total: 2,
      percentage: 50,
      duration_seconds: 42,
      created_at: "",
      results: [
        {
          question_id: 1,
          selected: "C",
          correct_answer: "C",
          is_correct: true,
          explanation: "3NF removes transitive dependencies.",
        },
        { question_id: 2, selected: "B", correct_answer: "A", is_correct: false, explanation: "Atomic values." },
      ],
    });
    const { ExamRunner } = await import("@/components/study/exam-runner");
    renderWithProviders(<ExamRunner studySetId={4} questions={QUESTIONS} timeLimitMinutes={15} />);

    expect(screen.getByTestId("question-counter")).toHaveTextContent("Question 1 of 2");
    expect(screen.getByTestId("exam-timer")).toHaveTextContent(/15:00 left|14:5\d left/);
    await userEvent.click(screen.getByTestId("option-C"));
    expect(screen.getByTestId("option-C")).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByTestId("question-counter")).toHaveTextContent("Question 2 of 2");
    await userEvent.click(screen.getByTestId("option-B"));
    await userEvent.click(screen.getByTestId("submit-exam"));

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(studyApi.submitAttempt).toHaveBeenCalledWith(4, { "1": "C", "2": "B" }, expect.any(Number)),
    );
    expect(await screen.findByTestId("quiz-score")).toHaveTextContent("1/2");
    expect(screen.getByText("Atomic values.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retake/ })).toBeInTheDocument();
  });
});
