// ==UserScript==
// @name        Canvas Grade Calculator
// @description Calculate grade totals for Canvas courses that have it disabled.
// @namespace   https://github.com/uncenter/canvas-grade-calculator
// @match       https://*.instructure.com/courses/*/grades
// @grant       none
// @downloadURL https://github.com/uncenter/canvas-grade-calculator/raw/main/index.js
// @homepageURL https://github.com/uncenter/canvas-grade-calculator
// @version     0.2.1
// @author      uncenter
// @license     MIT
// ==/UserScript==

function calculate() {
	if (!document.querySelector(".ic-app-main-content")) {
		console.error("Not on Canvas!");
		return;
	}

	if (!document.querySelector("#grade-summary-content")) {
		console.error("Not on grades page!");
		return;
	}

	const weights = {};

	document
		.querySelectorAll('[aria-label="Assignment Weights"] > table tbody > tr')
		.forEach((e) => {
			const group = e.querySelector("th").textContent;
			if (group === "Total") return;
			const weight =
				parseFloat(e.querySelector("td").textContent.slice(0, 2)) / 100;
			weights[group] = weight;
		});

	const assignments = [];

	document
		.querySelectorAll("#grades_summary tr.assignment_graded.student_assignment")
		.forEach((e) => {
			let earned, available, title, group;

			const a = e.querySelector("th.title");
			title = a.querySelector("a").textContent;
			group = a.querySelector("div.context").textContent;

			const grades = e.querySelector(
				"td.assignment_score > div > span.tooltip > span.grade"
			);
			for (let i = 0; i < grades.childNodes.length; i++) {
				const node = grades.childNodes[i];
				if (
					node.nodeType === Node.TEXT_NODE &&
					node.textContent.trim() !== ""
				) {
					earned = parseFloat(node.textContent.trim());
					break;
				}
			}
			available = parseFloat(
				grades.nextElementSibling.textContent.replace("/", "").trim()
			);

			assignments.push({ earned, available, title, group });
		});

	if (assignments.length === 0) {
		console.warn("No graded assignments found!");
		return;
	}

	const totalsPerGroup = assignments.reduce(
		(acc, { group, earned, available }) => {
			acc[group] = acc[group] || { totalEarned: 0, totalAvailable: 0 };
			acc[group].totalEarned += earned;
			acc[group].totalAvailable += available;
			return acc;
		},
		{}
	);

	const weightedPerGroup = {};
	for (const category in totalsPerGroup) {
		const { totalEarned, totalAvailable } = totalsPerGroup[category];
		weightedPerGroup[category] = (totalEarned / totalAvailable) * 100 || null;
	}

	let grade = 0;
	if (Object.entries(weights).length !== 0) {
		for (const category in weightedPerGroup) {
			grade += weightedPerGroup[category] * weights[category];
		}
	} else {
		console.log("Categories are not weighted.");
		const scores = Object.values(weightedPerGroup).filter((x) => x !== null);
		grade = scores.reduce((total, score) => total + score, 0) / scores.length;
	}

	console.log(
		`${grade.toFixed(2)}% across ${assignments.length} graded assignments.`
	);

	(
		document.querySelector("#student-grades-final") ||
		document.querySelector(".student_assignment.final_grade")
	).outerHTML = `<div class="student_assignment final_grade">Total: <span class="grade">${grade.toFixed(
		2
	)}%</span></div>`;
}

if (document.querySelector("#student-grades-final")) {
	const observer = new MutationObserver(calculate);

	observer.observe(document.getElementById("grades_summary"), {
		childList: true,
		subtree: true,
	});

	calculate();
}
