// Configuration
// Ajuster ici les vacances de l'académie (les semaines sont comptées par lundi).
// Utiliser skipWeeks pour ne pas sauter certaines semaines (false conserve les colles).
const VACATION_CONFIG = [
  {
    label: "Vacances de la Toussaint",
    start: "2025-10-20", // 1er Lundi des vacances
    weeks: 2,
    skipWeeks: [true, true],
  },
  {
    label: "Vacances de Noël",
    start: "2025-12-15", // 1er Lundi des vacances
    weeks: 3,
    skipWeeks: [true, true, true],
  },
  {
    label: "Vacances d'hiver",
    start: "2026-02-09", // 1er Lundi des vacances (Zone A)
    weeks: 2,
    skipWeeks: [false, true], // Réglage conservé de votre code
  },
  {
    label: "Vacances de printemps",
    start: "2026-04-06", // 1er Lundi des vacances (Zone A)
    weeks: 2,
    skipWeeks: [true, true],
  },
  {
    label: "Pont de l'Ascension",
    start: "2026-05-10", // Dimanche précédent le pont
    weeks: 1,
    skipWeeks: [true],
  },
];

const BASE_WEEK_KEY = "semaine_de_base";
const DATA_URL = "./colloscope.json";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const DAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

const elements = {
  classe: document.getElementById("classe"),
  groupe: document.getElementById("groupe"),
  results: document.getElementById("results"),
  weekText: document.getElementById("weekText"),
  weekStatus: document.getElementById("weekStatus"),
  mathContent: document.getElementById("mathContent"),
  physContent: document.getElementById("physContent"),
  loadingDot: document.getElementById("loadingDot"),
  courses: document.getElementById("coursesList"),
  mathCourse: document.getElementById("mathCourse"),
  physCourse: document.getElementById("physCourse"),
  weekPicker: document.getElementById("weekPicker"),
  // New elements for updated UI
  weekNavigation: document.getElementById("weekNavigation"),
  prevWeek: document.getElementById("prevWeek"),
  nextWeek: document.getElementById("nextWeek"),
  currentWeekBtn: document.getElementById("currentWeekBtn"),
};

let DATA = null;
let manualSelectionActive = false;
let manualWeekMonday = null;
let REFERENCE_MONDAY = null; // La semaine de référence du JSON

// Helper function to parse French day/time strings like "Lundi 18h" or "Jeudi 13h30"
function parseColleDate(dateStr, targetMonday) {
  const dayMap = {
    Lundi: 1,
    Mardi: 2,
    Mercredi: 3,
    Jeudi: 4,
    Vendredi: 5,
    Samedi: 6,
    Dimanche: 0,
  };

  const parts = dateStr.split(" ");
  const day = parts[0];
  const time = parts[1];

  // Use target Monday for the week
  const monday = new Date(targetMonday);
  monday.setHours(0, 0, 0, 0);

  // Calculate target date
  const targetDay = dayMap[day];
  const daysToAdd = targetDay === 0 ? 6 : targetDay - 1; // Monday is day 1
  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + daysToAdd);

  // Parse time
  const timeParts = time.replace("h", ":").split(":");
  const hours = parseInt(timeParts[0]);
  const minutes = timeParts[1] ? parseInt(timeParts[1]) : 0;

  targetDate.setHours(hours, minutes, 0, 0);

  return targetDate;
}

// Transform the JSON data to match expected structure
function transformData(rawData) {
  const transformed = {};

  // Find the first week key (e.g., "15sept2024")
  const weekKeys = Object.keys(rawData);
  if (weekKeys.length === 0) return {};

  // Parse the reference date from the key (e.g., "15sept2024" -> September 15, 2024)
  const weekKey = weekKeys[0];
  const dayMatch = weekKey.match(/(\d+)/);
  const monthMatch = weekKey.match(/[a-z]+/i);

  if (dayMatch && monthMatch) {
    const day = parseInt(dayMatch[1]);
    const monthStr = monthMatch[0].toLowerCase();
    const monthMap = {
      janv: 0,
      fevr: 1,
      mars: 2,
      avr: 3,
      mai: 4,
      juin: 5,
      juil: 6,
      aout: 7,
      sept: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const month = monthMap[monthStr.substr(0, 4)] || 8; // Default to September
    const year = weekKey.match(/\d{4}/)
      ? parseInt(weekKey.match(/\d{4}/)[0])
      : 2024;

    // Find the Monday for the reference week
    const referenceDate = new Date(year, month, day);
    REFERENCE_MONDAY = getMonday(referenceDate);
  } else {
    // Fallback to specific date - September 16, 2024 (Monday)
    REFERENCE_MONDAY = getMonday(new Date(2024, 8, 16)); // Month is 0-indexed, so 8 = September
  }

  // Use the first week as base week
  const baseWeekData = rawData[weekKey];

  // Transform to expected structure - store as slots, not by group
  transformed[BASE_WEEK_KEY] = {};

  for (const [className, classData] of Object.entries(baseWeekData)) {
    transformed[BASE_WEEK_KEY][className] = {
      maths: {},
      physique: {},
      maths_slots: [], // Store slots in order
      physique_slots: [], // Store slots in order
    };

    // Transform maths data
    if (classData.maths) {
      // Create slots array (ordered by group number)
      const mathsSlots = [];
      classData.maths.forEach((slot) => {
        const groupNum = parseInt(slot.groupe);
        mathsSlots[groupNum - 1] = {
          date: slot.date,
          salle: slot.salle,
        };
      });
      transformed[BASE_WEEK_KEY][className].maths_slots = mathsSlots;

      // Also store by group for initial lookup
      classData.maths.forEach((slot) => {
        const groupNum = parseInt(slot.groupe);
        transformed[BASE_WEEK_KEY][className].maths[groupNum] = {
          date: slot.date,
          salle: slot.salle,
        };
      });
    }

    // Transform physique data
    if (classData.physique) {
      // Create slots array (ordered by group number)
      const physiqueSlots = [];
      classData.physique.forEach((slot) => {
        const groupNum = parseInt(slot.groupe);
        physiqueSlots[groupNum - 1] = {
          date: slot.date,
          salle: slot.salle,
        };
      });
      transformed[BASE_WEEK_KEY][className].physique_slots = physiqueSlots;

      // Also store by group for initial lookup
      classData.physique.forEach((slot) => {
        const groupNum = parseInt(slot.groupe);
        transformed[BASE_WEEK_KEY][className].physique[groupNum] = {
          date: slot.date,
          salle: slot.salle,
        };
      });
    }
  }

  return transformed;
}

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonday(date) {
  const monday = startOfDay(date);
  const day = monday.getDay();
  if (day === 1) return monday;
  if (day === 0) {
    monday.setDate(monday.getDate() + 1);
  } else {
    monday.setDate(monday.getDate() - (day - 1));
  }
  return monday;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isBetween(date, start, end) {
  const d = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return d >= s && d <= e;
}

function getTargetMonday(now) {
  if (manualSelectionActive && manualWeekMonday) {
    return manualWeekMonday;
  }

  return getMonday(now);
}

function getWeekKey(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function holidayInfoFor(monday) {
  for (const vacation of VACATION_CONFIG) {
    const vacationStart = parseDate(vacation.start);
    const vacationEnd = addWeeks(vacationStart, vacation.weeks);
    if (isBetween(monday, vacationStart, addDays(vacationEnd, -1))) {
      return vacation;
    }
  }
  return null;
}

// Calculate the number of working weeks between two dates (skipping vacation weeks)
function calculateWorkingWeeksBetween(startMonday, endMonday) {
  let count = 0;
  let currentMonday = new Date(startMonday);

  while (currentMonday < endMonday) {
    const holidayInfo = holidayInfoFor(currentMonday);
    if (!holidayInfo) {
      count++;
    }
    currentMonday = addWeeks(currentMonday, 1);
  }

  return count;
}

function populateClasses() {
  const classeSelect = elements.classe;
  classeSelect.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  placeholderOption.textContent = "Choisir une classe";
  classeSelect.appendChild(placeholderOption);

  const classeNames = Object.keys(DATA[BASE_WEEK_KEY]);
  classeNames.sort((a, b) => a.localeCompare(b, "fr"));

  classeNames.forEach((classe) => {
    const option = document.createElement("option");
    option.value = classe;
    option.textContent = classe;
    classeSelect.appendChild(option);
  });
}

function populateGroups(classe) {
  const groupInput = elements.groupe;
  if (!classe || !DATA || !DATA[BASE_WEEK_KEY]) return;

  const groups = DATA[BASE_WEEK_KEY][classe];
  if (!groups) return;

  const maxGroup = Object.keys(groups.maths || {}).length;
  groupInput.max = maxGroup || 8;
  if (groupInput.value) {
    groupInput.value = Math.min(parseInt(groupInput.value, 10), groupInput.max);
  }
}

// CRITICAL FUNCTION - This is where the rotation happens
function findSlotForGroup(classe, subject, group, monday) {
  if (!DATA || !DATA[BASE_WEEK_KEY] || !REFERENCE_MONDAY) return null;

  const baseWeek = DATA[BASE_WEEK_KEY][classe];
  if (!baseWeek) return null;

  const slots = baseWeek[subject + "_slots"];
  if (!slots || slots.length === 0) return null;

  const numGroups = slots.length;

  // Calculate working weeks offset from reference (skipping vacations)
  const weekOffset = calculateWorkingWeeksBetween(REFERENCE_MONDAY, monday);

  // Apply rotation: group N goes to slot ((N - 1 + offset) % numGroups)
  // This means each week, every group moves to the next slot
  const rotatedSlotIndex =
    (((group - 1 - weekOffset) % numGroups) + numGroups) % numGroups;
  const slot = slots[rotatedSlotIndex];

  if (!slot) return null;

  // Parse the date for the target week
  const adjustedDate = parseColleDate(slot.date, monday);

  return {
    when: adjustedDate,
    salle: slot.salle,
  };
}

function savePreferences() {
  const preferences = {
    classe: elements.classe.value,
    groupe: elements.groupe.value,
    manualSelectionActive,
    manualWeek: manualWeekMonday ? manualWeekMonday.toISOString() : null,
  };
  localStorage.setItem("colloscopePreferences", JSON.stringify(preferences));
}

function loadPreferences() {
  const raw = localStorage.getItem("colloscopePreferences");
  if (!raw) return;
  try {
    const preferences = JSON.parse(raw);
    if (preferences.classe) {
      elements.classe.value = preferences.classe;
      populateGroups(preferences.classe);
    }
    if (preferences.groupe) {
      elements.groupe.value = preferences.groupe;
    }
    manualSelectionActive = Boolean(preferences.manualSelectionActive);
    if (preferences.manualWeek) {
      manualWeekMonday = getMonday(new Date(preferences.manualWeek));
      if (manualSelectionActive && manualWeekMonday) {
        elements.weekPicker.value = formatDateForInput(manualWeekMonday);
      }
    }
  } catch (e) {
    console.error("Cannot load preferences", e);
  }
}

// Updated formatSlotInfo to match new styling
function formatSlotInfo(slot) {
  if (!slot) {
    return `<div class="course-empty">Pas de colle cette semaine</div>`;
  }

  const dayName = DAYS[slot.when.getDay()];
  const date = slot.when.getDate();
  const month = MONTHS[slot.when.getMonth()];
  const hour = slot.when.getHours().toString().padStart(2, "0");
  const min = slot.when.getMinutes().toString().padStart(2, "0");

  return `
    <div class="course-slot">
      <div class="slot-datetime">
        ${dayName} ${date} ${month} à ${hour}h${min}
      </div>
      <div class="slot-details">
        <span class="slot-detail">Salle ${slot.salle}</span>
      </div>
    </div>
  `;
}

function updateCurrentWeekButton() {
  if (!elements.currentWeekBtn) return;

  const now = new Date();
  const currentMonday = getTargetMonday(now);
  const displayedMonday =
    manualSelectionActive && manualWeekMonday
      ? manualWeekMonday
      : currentMonday;

  const isCurrentWeek = isSameDay(currentMonday, displayedMonday);
  elements.currentWeekBtn.style.display = isCurrentWeek ? "none" : "block";
}

function render() {
  const classe = elements.classe.value;
  const groupNum = parseInt(elements.groupe.value, 10);

  if (!DATA || !DATA[BASE_WEEK_KEY]) {
    elements.results.style.display = "none";
    if (elements.weekNavigation) {
      elements.weekNavigation.style.display = "none";
    }
    elements.loadingDot.style.display = "none";
    return;
  }

  if (!classe || !groupNum || groupNum < 1) {
    elements.results.style.display = "none";
    if (elements.weekNavigation) {
      elements.weekNavigation.style.display = "none";
    }
    elements.loadingDot.style.display = "none";
    return;
  }

  savePreferences();

  // Show navigation and results
  if (elements.weekNavigation) {
    elements.weekNavigation.style.display = "flex";
  }
  elements.results.style.display = "block";

  const now = new Date();
  const useManual = manualSelectionActive && manualWeekMonday;
  const targetMonday = useManual
    ? startOfDay(manualWeekMonday)
    : getTargetMonday(now);
  const date = targetMonday.getDate();
  const month = MONTHS[targetMonday.getMonth()];
  const endDate = addDays(targetMonday, 4);
  const endDateNum = endDate.getDate();
  const endMonth = MONTHS[endDate.getMonth()];

  const holidayInfo = holidayInfoFor(targetMonday);
  const holiday = Boolean(holidayInfo);

  if (endDate.getMonth() === targetMonday.getMonth()) {
    elements.weekText.textContent = `${date} – ${endDateNum} ${month}`;
  } else {
    elements.weekText.textContent = `${date} ${month} – ${endDateNum} ${endMonth}`;
  }

  elements.weekStatus.textContent = holiday
    ? `${holidayInfo.label}`
    : `Semaine de cours`;
  elements.weekStatus.className = holiday ? "week-badge holiday" : "week-badge";

  let mathSlot = null;
  let physSlot = null;
  if (!holiday) {
    mathSlot = findSlotForGroup(classe, "maths", groupNum, targetMonday);
    physSlot = findSlotForGroup(classe, "physique", groupNum, targetMonday);
  }

  const subjects = [
    {
      slot: mathSlot,
      contentEl: elements.mathContent,
      courseEl: elements.mathCourse,
      order: 0,
    },
    {
      slot: physSlot,
      contentEl: elements.physContent,
      courseEl: elements.physCourse,
      order: 1,
    },
  ];

  subjects.forEach(({ slot, contentEl }) => {
    contentEl.innerHTML = formatSlotInfo(slot);
  });

  subjects
    .slice()
    .sort((a, b) => {
      if (!a.slot && !b.slot) return a.order - b.order;
      if (!a.slot) return 1;
      if (!b.slot) return -1;
      const diff = a.slot.when.getTime() - b.slot.when.getTime();
      return diff !== 0 ? diff : a.order - b.order;
    })
    .forEach(({ courseEl }) => {
      elements.courses.appendChild(courseEl);
    });

  // Update current week button visibility
  updateCurrentWeekButton();
  elements.loadingDot.style.display = "none";
}

function handleClasseChange() {
  const classe = elements.classe.value;
  populateGroups(classe);
  render();
}

function handleGroupeInput() {
  const value = elements.groupe.value;
  if (!value) {
    render();
    return;
  }
  const groupNum = parseInt(value, 10);
  if (
    Number.isNaN(groupNum) ||
    groupNum < 1 ||
    groupNum > parseInt(elements.groupe.max, 10)
  ) {
    elements.groupe.setCustomValidity(
      "Veuillez entrer un numéro de groupe valide"
    );
    return;
  }

  elements.groupe.setCustomValidity("");
  render();
}

function handleWeekPickerChange() {
  const value = elements.weekPicker.value;
  if (value) {
    manualWeekMonday = getMonday(new Date(value));
    manualSelectionActive = true;
    elements.weekPicker.value = formatDateForInput(manualWeekMonday);
  } else {
    manualWeekMonday = null;
    manualSelectionActive = false;
  }
  render();
}

// NEW FUNCTIONS FOR UPDATED UI
function handlePrevWeek() {
  const currentDisplay =
    manualSelectionActive && manualWeekMonday
      ? manualWeekMonday
      : getTargetMonday(new Date());

  const prevMonday = addWeeks(currentDisplay, -1);
  manualWeekMonday = prevMonday;
  manualSelectionActive = true;
  elements.weekPicker.value = formatDateForInput(prevMonday);
  render();
}

function handleNextWeek() {
  const currentDisplay =
    manualSelectionActive && manualWeekMonday
      ? manualWeekMonday
      : getTargetMonday(new Date());

  const nextMonday = addWeeks(currentDisplay, 1);
  manualWeekMonday = nextMonday;
  manualSelectionActive = true;
  elements.weekPicker.value = formatDateForInput(nextMonday);
  render();
}

function handleCurrentWeek() {
  manualSelectionActive = false;
  manualWeekMonday = null;
  const currentMonday = getTargetMonday(new Date());
  elements.weekPicker.value = formatDateForInput(currentMonday);
  render();
}

function init() {
  loadPreferences();

  if (elements.weekPicker) {
    elements.weekPicker.setAttribute("lang", "fr-FR");
  }

  elements.classe.addEventListener("change", handleClasseChange);
  elements.groupe.addEventListener("input", handleGroupeInput);
  elements.weekPicker.addEventListener("input", handleWeekPickerChange);

  // New button handlers
  if (elements.prevWeek) {
    elements.prevWeek.addEventListener("click", handlePrevWeek);
  }
  if (elements.nextWeek) {
    elements.nextWeek.addEventListener("click", handleNextWeek);
  }
  if (elements.currentWeekBtn) {
    elements.currentWeekBtn.addEventListener("click", handleCurrentWeek);
  }

  // Initialize week picker with current week
  const currentMonday = getTargetMonday(new Date());
  elements.weekPicker.value = formatDateForInput(currentMonday);
}

function boot() {
  init();
  render();
}

function setupVisibilityRefresh() {
  let refreshTimeout = null;

  function scheduleRefresh() {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(() => {
      render();
    }, 500);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleRefresh();
    }
  });

  window.addEventListener("focus", scheduleRefresh);
}

// Load data and start
async function fetchData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawData = await res.json();
    DATA = transformData(rawData); // Transform the data
    populateClasses();
    boot();
  } catch (e) {
    console.error("Cannot load data", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchData();
  setupVisibilityRefresh();
});

// Debug functions
function logDebugInfo() {
  console.group("Debug Colloscope");
  console.log("Manual selection active:", manualSelectionActive);
  console.log("Manual week monday:", manualWeekMonday);
  console.log("Reference Monday:", REFERENCE_MONDAY);
  console.log("Classe:", elements.classe.value);
  console.log("Groupe:", elements.groupe.value);
  console.log("DATA:", DATA);

  if (elements.classe.value && elements.groupe.value) {
    const targetMonday =
      manualSelectionActive && manualWeekMonday
        ? manualWeekMonday
        : getTargetMonday(new Date());
    const weekOffset = calculateWorkingWeeksBetween(
      REFERENCE_MONDAY,
      targetMonday
    );
    console.log("Target Monday:", targetMonday);
    console.log("Week offset from reference:", weekOffset);
  }

  console.groupEnd();
}

window.colloscopeDebug = {
  log: logDebugInfo,
  refresh: render,
  data: () => DATA,
  reference: () => REFERENCE_MONDAY,
};
