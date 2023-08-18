const showAllDetailsButton = document.querySelector("#show_all_details_button");
const API_URL = "https://ubcgrades.com/api/v3/course-statistics/UBCV";

async function main() {
  showAllDetailsButton.click();

  const { myAvg, classAvg, fiveYearAvg } = await getAverages();

  requestAnimationFrame(() => showAllDetailsButton.click());

  const myAverageBox = getAverageBox("My average", myAvg);
  const classAverageBox = getAverageBox("Class average", classAvg);
  const fiveYearAverageBox = getAverageBox("5-year average", fiveYearAvg);
  const extensionLabel = getExtensionLabel();

  const container = getContainer(
    myAverageBox,
    classAverageBox,
    fiveYearAverageBox
  );

  const assignmentsOnPage = document.querySelector("#assignments");
  assignmentsOnPage.insertAdjacentElement("beforebegin", container);
  assignmentsOnPage.insertAdjacentElement("beforebegin", extensionLabel);
}

if (showAllDetailsButton) {
  main();
}

async function getAverages() {
  const courseName = getCourseName();

  const groupPercentages = getGroupPercentages([
    ...document.querySelectorAll("table.summary tr"),
  ]);

  const assignmentsByGroup = getAssignmentsByGroup([
    ...document.querySelectorAll(
      "tr.student_assignment:not(.group_total):not(.final_grade)"
    ),
  ]);

  const { myCumulativeScore, classCumulativeScore, ungradedPercentage } =
    getAverageScores(assignmentsByGroup, groupPercentages);

  const myAvg = getAdjustedScore(myCumulativeScore, ungradedPercentage);
  const classAvg = getAdjustedScore(classCumulativeScore, ungradedPercentage);
  const fiveYearAvg = await fetchFiveYearAvg(courseName);

  return {
    myAvg,
    classAvg,
    fiveYearAvg,
  };
}

async function fetchFiveYearAvg(courseName) {
  return fetch(`${API_URL}/${courseName}`)
    .then((response) => response.json())
    .then((data) => Math.round(data["average_past_5_yrs"] * 10) / 10);
}

function getAdjustedScore(score, ungradedPercentage) {
  return round((score / (1 - ungradedPercentage)) * 100);
}

function round(num) {
  return Math.round(num * 10) / 10;
}

function getCourseName() {
  return document
    .querySelector("#breadcrumbs")
    .innerText.trim()
    .split(" ")
    .slice(0, 2)
    .join("/");
}

function getGroupPercentages(rows) {
  const groupPercentages = new Map();

  rows.slice(1).forEach((row) => {
    const key = row.querySelector("th").textContent;
    const value =
      parseFloat(row.querySelector("td").textContent.replace("%", "")) / 100;

    if (key !== "Total" && value > 0 && value < 1) {
      groupPercentages.set(key, value);
    }
  });

  return groupPercentages;
}

function getScore(element) {
  const numerator = element
    .querySelector("td.assignment_score .tooltip")
    .childNodes[1].childNodes[4].textContent.trim();

  const denominator = element
    .querySelector("td.assignment_score .tooltip")
    .childNodes[3].textContent.replaceAll("/", "");

  return parseFloat(numerator) / parseFloat(denominator);
}

function getExtensionLabel() {
  const extensionLabel = document.createElement("a");
  extensionLabel.textContent = "Class Average Extension";
  extensionLabel.href = "https://github.com/dburenok/canvas-class-average";
  extensionLabel.className = "extension-label";

  return extensionLabel;
}

function getContainer(myAverageBox, classAverageBox, fiveYearAverageBox) {
  const container = document.createElement("div");
  container.className = "extension-container";
  container.insertAdjacentElement("beforeend", myAverageBox);
  container.insertAdjacentElement("beforeend", classAverageBox);
  container.insertAdjacentElement("beforeend", fiveYearAverageBox);

  return container;
}

function extractNum(textContent) {
  return parseFloat(textContent.split(":")[1].trim());
}

function getAssignmentsByGroup(elements) {
  const assignmentsByGroup = new Map();

  elements.forEach((elem) => {
    const scoreDetails = elem.nextSibling.nextSibling.nextSibling.nextSibling;
    const tds = scoreDetails.querySelectorAll(".score_details_table td");

    const graded =
      elem.dataset.pending_quiz === "false" && elem.dataset.muted === "false";

    let assignment = {
      name: elem.querySelector("th.title a").textContent.trim(),
      group: elem.querySelector("th.title div.context").textContent.trim(),
      graded,
    };

    if (graded) {
      assignment = {
        ...assignment,
        score: getScore(elem),
        scoreDetails: {
          mean:
            extractNum(tds[0].childNodes[0].textContent) /
            parseFloat(
              elem
                .querySelector("td.assignment_score .tooltip")
                .childNodes[3].textContent.replaceAll("/", "")
            ),
          // high: extractNum(tds[1].childNodes[0].textContent), // TODO can be a new feature
          // low: extractNum(tds[2].childNodes[0].textContent),
          // median: extractNum(tds[0].childNodes[2].textContent),
          // upperQuartile: extractNum(tds[1].childNodes[2].textContent),
          // lowerQuartile: extractNum(tds[2].childNodes[2].textContent),
        },
      };
    }

    const group = assignment.group;

    if (!assignmentsByGroup.has(group)) {
      assignmentsByGroup.set(group, [assignment]);
    } else {
      assignmentsByGroup.set(group, [
        ...assignmentsByGroup.get(group),
        assignment,
      ]);
    }
  });

  return assignmentsByGroup;
}

function getAssignmentGroupAvailablePercent(groupPercentages) {
  return [...groupPercentages.values()].reduce((pv, cv) => pv + cv, 0);
}

function percentageToLetterGrade(percentage) {
  if (percentage === undefined) {
    return "N/A";
  }

  if (percentage >= 89.5) {
    return "A+";
  }

  if (percentage >= 84.5) {
    return "A";
  }

  if (percentage >= 79.5) {
    return "A-";
  }

  if (percentage >= 75.5) {
    return "B+";
  }

  if (percentage >= 71.5) {
    return "B";
  }

  if (percentage >= 67.5) {
    return "B-";
  }

  if (percentage >= 63.5) {
    return "C+";
  }

  if (percentage >= 59.5) {
    return "C";
  }

  if (percentage >= 54.5) {
    return "C-";
  }

  if (percentage >= 49.5) {
    return "D";
  }

  return "F";
}

function getAverageScores(assignmentsByGroup, groupPercentages) {
  let myCumulativeScore = 0;
  let classCumulativeScore = 0;
  let ungradedPercentage = 0;

  const availablePercent = getAssignmentGroupAvailablePercent(groupPercentages);

  for (const group of assignmentsByGroup.keys()) {
    const assignmentPercentage = groupPercentages.get(group) / availablePercent; // adjusts for totals that don't add up to 100

    const assignments = assignmentsByGroup.get(group);
    const gradedAssignments = assignments.filter((a) => a.graded);
    const ungradedAssignments = assignments.filter((a) => !a.graded);
    const percentagePerAssignment = assignmentPercentage / assignments.length;

    for (const assignment of gradedAssignments) {
      myCumulativeScore += assignment.score * percentagePerAssignment;

      classCumulativeScore +=
        assignment.scoreDetails.mean * percentagePerAssignment;
    }

    ungradedPercentage += ungradedAssignments.length * percentagePerAssignment;
  }
  return {
    myCumulativeScore,
    classCumulativeScore,
    ungradedPercentage,
  };
}


function getAverageBox(titleText, average) {
  const wrapper = document.createElement("div");
  wrapper.className = "extension-wrapper";

  const title = document.createElement("p");
  title.textContent = titleText + ":";
  title.className = "extension-title";

  const percentage = document.createElement("p");
  percentage.textContent = `${average}%`;
  percentage.className = "extension-percentage";

  const letterGrade = document.createElement("p");
  letterGrade.textContent = percentageToLetterGrade(average);
  letterGrade.className = "extension-letter-grade";

  wrapper.insertAdjacentElement("beforeend", title);
  wrapper.insertAdjacentElement("beforeend", percentage);
  wrapper.insertAdjacentElement("beforeend", letterGrade);

  return wrapper;
}
