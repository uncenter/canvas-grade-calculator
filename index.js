// ==UserScript==
// @name        Canvas Grade Calculator
// @description Calculate grade totals for Canvas courses that have it disabled.
// @namespace   https://github.com/uncenter/canvas-grade-calculator
// @match       https://*.instructure.com/courses/*/grades
// @grant       none
// @downloadURL https://github.com/uncenter/canvas-grade-calculator/raw/main/index.js
// @homepageURL https://github.com/uncenter/canvas-grade-calculator
// @version     0.2.2
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

	// Scrape weights table for category/group names and percentages.
	for (const element of document.querySelectorAll(
		'[aria-label="Assignment Weights"] > table tbody > tr'
	)) {
		const group = element.querySelector("th").textContent;
		if (group === "Total") continue;
		const weight =
			Number.parseFloat(element.querySelector("td").textContent.slice(0, 2)) /
			100;
		weights[group] = weight;
	}

	const assignments = [];

	// Scrape assignments table for graded assignments.
	for (const element of document.querySelectorAll(
		"#grades_summary tr.assignment_graded.student_assignment"
	)) {
		let earned, available, title, group;

		const a = element.querySelector("th.title");
		title = a.querySelector("a").textContent;
		group = a.querySelector("div.context").textContent;

		const grades = element.querySelector(
			"td.assignment_score > div > span.tooltip > span.grade"
		);

		const score = [...grades.childNodes]
			.find(
				(node) =>
					node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ""
			)
			?.textContent.trim();

		if (
			score.includes("%") ||
			!grades.nextElementSibling.textContent.includes("/")
		) {
			earned = Number.parseFloat(score.replace("%", ""));
			available = 100;
		} else {
			earned = Number.parseFloat(score);
			if (typeof earned !== "number" || Number.isNaN(earned)) continue;

			available = Number.parseFloat(
				grades.nextElementSibling.textContent.replace("/", "").trim()
			);
		}

		assignments.push({ earned, available, title, group });
	}

	if (assignments.length === 0) {
		console.warn("No graded assignments found!");
		return;
	}

	/* eslint-disable unicorn/prevent-abbreviations, unicorn/no-array-reduce */
	// Convert assignments array into an object of type { [category]: { totalEarned: number, totalAvailable: number }].
	const totalsPerGroup = assignments.reduce(
		(acc, { group, earned, available }) => {
			acc[group] = acc[group] || { totalEarned: 0, totalAvailable: 0 };
			acc[group].totalEarned += earned;
			acc[group].totalAvailable += available;
			return acc;
		},
		{}
	);
	/* eslint-enable */

	// Take per-group totals and conver them into percentage values.
	const groupPercentages = {};
	for (const category in totalsPerGroup) {
		const { totalEarned, totalAvailable } = totalsPerGroup[category];
		groupPercentages[category] =
			(totalEarned / totalAvailable) * 100 || undefined;
	}

	let grade = 0;
	if (Object.entries(weights).length === 0) {
		// No weights, so we can just take total earned and available combined from all groups and get the percentage.
		console.log("Categories are not weighted.");
		let totalAvailable = 0;
		let totalEarned = 0;
		for (const group of Object.values(totalsPerGroup)) {
			totalEarned += group.totalEarned;
			totalAvailable += group.totalAvailable;
		}
		grade = (totalEarned / totalAvailable) * 100;
	} else {
		// Weights, so multiply each group's percentage by that group's weight and add to total.
		for (const category in groupPercentages) {
			grade += groupPercentages[category] * weights[category];
		}
	}

	console.log(
		`${grade.toFixed(2)}% across ${assignments.length} graded assignments.`
	);

	// Replace the "Calculation of totals has been disabled" message with the calculated grade.
	(
		document.querySelector("#student-grades-final") ||
		document.querySelector(".student_assignment.final_grade")
	).outerHTML = `<div class="student_assignment final_grade">Total: <span class="grade">${grade.toFixed(
		2
	)}%</span></div>`;

	// Add the group totals and percentages to each respective group section at the bottom of the table.
	for (const element of document.querySelectorAll(
		"#grades_summary .student_assignment.hard_coded.group_total"
	)) {
		const group = element.querySelector("th.title").textContent.trim();

		element.querySelector(
			"td.assignment_score .tooltip > .grade"
		).innerHTML = `<span class="grade">${groupPercentages[group].toFixed(
			2
		)}%</span>`;

		const { totalEarned, totalAvailable } = totalsPerGroup[group];

		element.querySelector(
			"td.details"
		).innerHTML = `<span class="possible points_possible" aria-label="">${totalEarned.toFixed(
			2
		)} / ${totalAvailable.toFixed(2)}</span>`;
	}

	// Create and append the total section to the bottom of the table.
	const temporary = document.createElement("tr");
	temporary.className =
		"student_assignment hard_coded final_grade feedback_visibility_ff";
	temporary.id = "submission_final-grade";
	temporary.innerHTML = `<th class=title scope=row>Total<td class=due><td class=status scope=row><td class=assignment_score><div style=position:relative;height:100% class=score_holder><span class=assignment_presenter_for_submission style=display:none></span> <span class=react_pill_container></span> <span class=tooltip><span class=grade>${grade.toFixed(
		2
	)}%</span></span><div style=display:none><span class=original_points></span><span class=original_score></span><span class=what_if_score></span><span class=student_entered_score></span> <span class=submission_status>none </span><span class=assignment_group_id></span> <span class=assignment_id>final-grade</span> <span class=group_weight></span> <span class=rules></span></div></div><td class=details><span class="points_possible possible"aria-label=""></span>`;
	document.querySelector("#grades_summary tbody").append(temporary);
}

// const observer = new MutationObserver(calculate);

// if (document.querySelector("#student-grades-final") || true) {
// 	for (const el of document.querySelectorAll(
// 		"#grades_summary tr.assignment_graded.student_assignment"
// 	)) {
// 		observer.observe(el, {
// 			childList: true,
// 			subtree: true,
// 		});
// 	}

// 	calculate();
// }

calculate();
