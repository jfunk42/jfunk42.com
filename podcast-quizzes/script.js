const state = {
  quizzes: [],
  selectedQuiz: null,
};

const elements = {
  loadStatus: document.querySelector("#load-status"),
  quizContent: document.querySelector("#quiz-content"),
  quizTitle: document.querySelector("#quiz-title"),
  quizDate: document.querySelector("#quiz-date"),
  quizDescription: document.querySelector("#quiz-description"),
  spotifyEpisode: document.querySelector("#spotify-episode"),
  questions: document.querySelector("#questions"),
  searchInput: document.querySelector("#quiz-search"),
  searchCount: document.querySelector("#search-count"),
  searchResults: document.querySelector("#search-results"),
  recentQuizzes: document.querySelector("#recent-quizzes"),
};

function formatPublishedDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getRequestedTitle() {
  const hash = window.location.hash.slice(1);

  if (!hash) {
    return null;
  }

  try {
    return decodeURIComponent(hash);
  } catch {
    return null;
  }
}

function setSelectedQuizUrl(quiz, replace = false) {
  const url = new URL(window.location.href);
  url.hash = quiz === state.quizzes[0] ? "" : encodeURIComponent(quiz.title);

  if (replace) {
    window.history.replaceState({ quizTitle: quiz.title }, "", url);
    return;
  }

  window.history.pushState({ quizTitle: quiz.title }, "", url);
}

function getSelectedQuiz() {
  const requestedTitle = getRequestedTitle();
  return state.quizzes.find((quiz) => quiz.title === requestedTitle) || state.quizzes[0];
}

function createQuizLink(quiz) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  const date = document.createElement("span");

  link.href = `#${encodeURIComponent(quiz.title)}`;
  link.textContent = quiz.title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    selectQuiz(quiz);
  });
  date.className = "link-date";
  date.textContent = formatPublishedDate(quiz.publishedAt);
  item.append(link, date);
  return item;
}

function renderQuizLinks(container, quizzes) {
  container.replaceChildren(...quizzes.map(createQuizLink));
}

function renderSearchResults() {
  const term = elements.searchInput.value.trim().toLocaleLowerCase();
  const matches = state.quizzes.filter((quiz) => {
    const searchableText = [quiz.title, quiz.description, ...quiz.tags].join(" ").toLocaleLowerCase();
    return searchableText.includes(term);
  });

  elements.searchCount.textContent = term
    ? `${matches.length} ${matches.length === 1 ? "quiz" : "quizzes"} found`
    : `${state.quizzes.length} quizzes available`;
  renderQuizLinks(elements.searchResults, matches);
}

function renderQuestions(quiz) {
  const questionElements = quiz.questions.map((question, questionIndex) => {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const choices = document.createElement("div");
    const feedback = document.createElement("div");

    section.className = "question";
    heading.textContent = `${questionIndex + 1}. ${question.question}`;
    choices.className = "choices";
    feedback.className = "feedback";
    feedback.hidden = true;

    question.choices.forEach((choice, choiceIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = choice.text;
      button.setAttribute("aria-label", `Answer ${choiceIndex + 1}: ${choice.text}`);
      button.addEventListener("click", () => {
        choices.querySelectorAll("button").forEach((item) => {
          item.disabled = true;
          item.classList.toggle("is-correct", item === button && choice.correct);
          item.classList.toggle("is-incorrect", item === button && !choice.correct);
        });

        feedback.replaceChildren();
        feedback.hidden = false;

        const result = document.createElement("strong");
        result.textContent = choice.correct ? "Correct." : "Not quite.";
        feedback.append(result, document.createTextNode(` ${choice.explanation}`));

        if (choice.correct) {
          const source = document.createElement("a");
          source.href = choice.source.url;
          source.target = "_blank";
          source.rel = "noreferrer";
          source.textContent = `Read the source: ${choice.source.label}`;
          feedback.append(document.createElement("br"), source);
        }
      });
      choices.append(button);
    });

    section.append(heading, choices, feedback);
    return section;
  });

  elements.questions.replaceChildren(...questionElements);
}

function renderSelectedQuiz() {
  const quiz = state.selectedQuiz;
  elements.quizTitle.textContent = quiz.title;
  elements.quizDate.textContent = formatPublishedDate(quiz.publishedAt);
  elements.quizDescription.textContent = quiz.description;
  const spotifyLink = elements.spotifyEpisode.querySelector("a");
  const hasSpotifyEpisode = typeof quiz.spotifyUrl === "string";
  elements.spotifyEpisode.hidden = !hasSpotifyEpisode;
  spotifyLink.href = hasSpotifyEpisode ? quiz.spotifyUrl : "";
  renderQuestions(quiz);
}

function selectQuiz(quiz) {
  state.selectedQuiz = quiz;
  renderSelectedQuiz();
  setSelectedQuizUrl(quiz);
  document.title = `${quiz.title} | Podcast Quizzes`;
}

function syncSelectedQuizFromUrl() {
  const quiz = getSelectedQuiz();
  state.selectedQuiz = quiz;
  renderSelectedQuiz();
  document.title = `${quiz.title} | Podcast Quizzes`;
}

function isValidQuiz(quiz) {
  return quiz
    && typeof quiz.title === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(quiz.publishedAt)
    && typeof quiz.description === "string"
    && (quiz.spotifyUrl === undefined || (
      typeof quiz.spotifyUrl === "string"
      && /^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]+(?:\?.*)?$/.test(quiz.spotifyUrl)
    ))
    && Array.isArray(quiz.tags)
    && Array.isArray(quiz.questions)
    && quiz.questions.length > 0
    && quiz.questions.every((question) => (
      typeof question.question === "string"
      && Array.isArray(question.choices)
      && question.choices.length > 1
      && question.choices.filter((choice) => choice.correct === true).length === 1
      && question.choices.every((choice) => (
        typeof choice.text === "string"
        && typeof choice.explanation === "string"
        && (choice.correct !== true || (
          choice.source
          && typeof choice.source.label === "string"
          && typeof choice.source.url === "string"
          && /^https:\/\//.test(choice.source.url)
        ))
      ))
    ));
}

async function loadQuizzes() {
  try {
    const response = await fetch("./data/quizzes.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load quizzes: ${response.status}`);
    }

    const quizzes = await response.json();
    if (!Array.isArray(quizzes) || quizzes.length === 0 || !quizzes.every(isValidQuiz)) {
      throw new Error("Quiz data has an invalid format.");
    }

    state.quizzes = [...quizzes].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
    renderQuizLinks(elements.recentQuizzes, state.quizzes.slice(0, 5));
    elements.searchInput.addEventListener("input", renderSearchResults);
    renderSearchResults();
    syncSelectedQuizFromUrl();
    elements.loadStatus.hidden = true;
    elements.quizContent.hidden = false;
  } catch (error) {
    elements.loadStatus.textContent = `Unable to load quizzes. ${error.message}`;
    elements.loadStatus.classList.add("is-error");
  }
}

window.addEventListener("hashchange", syncSelectedQuizFromUrl);
window.addEventListener("popstate", syncSelectedQuizFromUrl);
loadQuizzes();
