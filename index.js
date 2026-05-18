const POKEMON_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=1500";
const FLIP_DELAY_MS = 900;
const POWER_UP_MS = 2000;

const difficulties = {
  easy: { pairs: 3, time: 60, columns: 3 },
  medium: { pairs: 6, time: 90, columns: 4 },
  hard: { pairs: 8, time: 120, columns: 4 },
};

let firstCard = undefined;
let secondCard = undefined;
let lockBoard = false;
let gameActive = false;
let gameEnded = false;

let clicks = 0;
let pairsMatched = 0;
let totalPairs = 3;
let timeLeft = 60;
let maxTime = 60;
let timer = undefined;
let powerUpUsed = false;
let currentTheme = "light";

// Set up the game and button events
function setup() {
  updateClock();
  setInterval(updateClock, 1000);

  $("#startBtn").on("click", startGame);
  $("#resetBtn").on("click", resetGame);
  $("#themeBtn").on("click", switchTheme);
  $("#powerBtn").on("click", usePowerUp);
  $("#difficultySelect").on("change", resetGame);

  setupCards();
  updateStatus();
}

// Use jQuery click logic like the starter code
function setupCards() {
  $(".card").off("click");
  $(".card").on("click", flipCard);
}

// Start a new game
async function startGame() {
  const level = $("#difficultySelect").val();
  const settings = difficulties[level];

  resetState(settings);
  showMessage("Loading random Pokemon from PokeAPI...");
  $("#startBtn").prop("disabled", true);

  try {
    const pokemon = await getRandomPokemon(settings.pairs);
    buildBoard(pokemon, settings.columns);
    gameActive = true;
    showMessage("Game started. Find all matching pairs!");
    startTimer();
  } catch (error) {
    console.log(error);
    const fallbackPokemon = getFallbackPokemon(settings.pairs);
    buildBoard(fallbackPokemon, settings.columns);
    gameActive = true;
    showMessage("PokeAPI could not load, so fallback Pokemon cards are used.");
    startTimer();
  }

  $("#startBtn").prop("disabled", false);
  updateStatus();
}

// Reset the game
function resetGame() {
  const level = $("#difficultySelect").val();
  const settings = difficulties[level];

  resetState(settings);

  const fallbackPokemon = getFallbackPokemon(settings.pairs);
  buildBoard(fallbackPokemon, settings.columns);
  showMessage("Click Start to load a new random Pokemon game.");
  updateStatus();
}

// Reset all game variables
function resetState(settings) {
  clearInterval(timer);
  timer = undefined;

  firstCard = undefined;
  secondCard = undefined;
  lockBoard = false;
  gameActive = false;
  gameEnded = false;

  clicks = 0;
  pairsMatched = 0;
  totalPairs = settings.pairs;
  maxTime = settings.time;
  timeLeft = settings.time;
  powerUpUsed = false;

  $("#powerBtn").prop("disabled", false);
}

// Fetch random Pokémon data from PokéAPI
async function getRandomPokemon(count) {
  const listResponse = await fetch(POKEMON_LIST_URL);

  if (!listResponse.ok) {
    throw new Error("Pokemon list did not load.");
  }

  const listData = await listResponse.json();
  const allPokemon = listData.results;
  const chosenPokemon = [];
  const usedIds = new Set();

  while (chosenPokemon.length < count) {
    const randomPokemon =
      allPokemon[Math.floor(Math.random() * allPokemon.length)];

    const id = getPokemonIdFromUrl(randomPokemon.url);

    if (usedIds.has(id)) {
      continue;
    }

    const detailResponse = await fetch(randomPokemon.url);

    if (!detailResponse.ok) {
      continue;
    }

    const detail = await detailResponse.json();
    const image = detail.sprites?.other?.["official-artwork"]?.front_default;

    if (!image) {
      continue;
    }

    usedIds.add(id);

    chosenPokemon.push({
      id: detail.id,
      name: detail.name,
      image: image,
    });
  }

  return chosenPokemon;
}

// Get Pokémon id from the API url
function getPokemonIdFromUrl(url) {
  return url.split("/").filter(Boolean).pop();
}

// Backup cards if PokéAPI cannot load
function getFallbackPokemon(count) {
  const fallback = [
    { id: 1, name: "bulbasaur", image: "001.png" },
    { id: 2, name: "ivysaur", image: "002.png" },
    { id: 3, name: "venusaur", image: "003.png" },
    { id: 4, name: "charmander", image: "001.png" },
    { id: 5, name: "charmeleon", image: "002.png" },
    { id: 6, name: "charizard", image: "003.png" },
    { id: 7, name: "squirtle", image: "001.png" },
    { id: 8, name: "wartortle", image: "002.png" },
  ];

  return fallback.slice(0, count);
}

// Generate the cards dynamically and build the game board
function buildBoard(pokemonList, columns) {
  const cards = [];

  pokemonList.forEach(function (pokemon) {
    cards.push(pokemon);
    cards.push(pokemon);
  });

  shuffle(cards);

  $("#game_grid").css("--columns", columns);
  $("#game_grid").empty();

  cards.forEach(function (pokemon, index) {
    $("#game_grid").append(buildCardHtml(pokemon, index + 1));
  });

  setupCards();
}

// Same card structure as the starter code, but images come from PokéAPI
function buildCardHtml(pokemon, index) {
  return `
    <div class="card" data-pokemon-id="${pokemon.id}" data-pokemon-name="${pokemon.name}">
      <img id="img${index}" class="front_face" src="${pokemon.image}" alt="${pokemon.name}">
      <img class="back_face" src="back.webp" alt="Pokemon card back">
    </div>
  `;
}

// Shuffle cards before displaying them
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// Handle the card flipping and matching logic
function flipCard() {
  if (!gameActive || gameEnded || lockBoard) {
    return;
  }

  const clickedCard = $(this);

  // Prevent clicking matched cards again
  if (clickedCard.hasClass("matched")) {
    return;
  }

  // Prevent clicking the same card twice
  if (firstCard && clickedCard[0] === firstCard[0]) {
    return;
  }

  clickedCard.addClass("flip");
  clicks++;
  updateStatus();

  if (!firstCard) {
    firstCard = clickedCard;
    return;
  }

  secondCard = clickedCard;

  // Prevent users from flipping more than two cards at the same time
  lockBoard = true;

  checkForMatch();
}

// Check if the two selected cards match
function checkForMatch() {
  const firstPokemon = firstCard.data("pokemon-id");
  const secondPokemon = secondCard.data("pokemon-id");

  if (firstPokemon === secondPokemon) {
    handleMatch();
  } else {
    handleNoMatch();
  }
}

// Handle matched cards
function handleMatch() {
  firstCard.addClass("matched");
  secondCard.addClass("matched");

  // Matched cards no longer have click events
  firstCard.off("click");
  secondCard.off("click");

  pairsMatched++;
  resetTurn();
  updateStatus();

  if (pairsMatched === totalPairs) {
    endGame(true);
  }
}

// Handle cards that do not match
function handleNoMatch() {
  setTimeout(function () {
    firstCard.removeClass("flip");
    secondCard.removeClass("flip");
    resetTurn();
    updateStatus();
  }, FLIP_DELAY_MS);
}

// Reset selected cards for the next turn
function resetTurn() {
  firstCard = undefined;
  secondCard = undefined;
  lockBoard = false;
}

// Update the timer during the game
function startTimer() {
  clearInterval(timer);

  timer = setInterval(function () {
    if (!gameActive || gameEnded) {
      return;
    }

    timeLeft--;
    updateStatus();

    if (timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);
}

// End the game with win or lose message
function endGame(didWin) {
  gameEnded = true;
  gameActive = false;
  lockBoard = true;

  clearInterval(timer);
  $(".card").off("click");

  if (didWin) {
    showMessage("You win! All Pokemon pairs were matched.", "win");
  } else {
    showMessage(
      "Game over! The timer ran out before all pairs were matched.",
      "lose",
    );
  }
}

// Power-up feature: temporarily reveal all unmatched cards
function usePowerUp() {
  if (!gameActive || gameEnded || powerUpUsed) {
    return;
  }

  powerUpUsed = true;
  lockBoard = true;

  $("#powerBtn").prop("disabled", true);

  showMessage(
    "Power up activated! All unmatched cards are shown for 2 seconds.",
  );

  const cardsToShow = $(".card").not(".matched");
  cardsToShow.addClass("flip");

  setTimeout(function () {
    cardsToShow.each(function () {
      const card = $(this);

      if (
        !card.hasClass("matched") &&
        card[0] !== firstCard?.[0] &&
        card[0] !== secondCard?.[0]
      ) {
        card.removeClass("flip");
      }
    });

    lockBoard = false;
    showMessage("Power up used. Keep matching cards!");
  }, POWER_UP_MS);
}

// Theme switching logic
function switchTheme() {
  if (currentTheme === "light") {
    currentTheme = "dark";
    $("body").addClass("dark");
    $("#themeBtn").text("Light Mode");
  } else {
    currentTheme = "light";
    $("body").removeClass("dark");
    $("#themeBtn").text("Dark Mode");
  }
}

// Update the status header during the game
function updateStatus() {
  $("#timeLeft").text(timeLeft + "s");
  $("#timeElapsed").text(maxTime - timeLeft + "s");
  $("#clickCount").text(clicks);
  $("#pairsMatched").text(pairsMatched);
  $("#totalPairs").text(totalPairs);
  $("#pairsLeft").text(totalPairs - pairsMatched);
}

// Show the current time
function updateClock() {
  const now = new Date();
  $("#currentTime").text(now.toLocaleTimeString());
}

// Show messages to the player
function showMessage(text, type) {
  const message = $("#message");

  message.removeClass("win lose");

  if (type) {
    message.addClass(type);
  }

  message.text(text);
}

$(document).ready(setup);
