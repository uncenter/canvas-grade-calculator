// ==UserScript==
// @name        Canvas Grade Calculator
// @description Calculate grade totals for Canvas courses that have it disabled.
// @namespace   https://github.com/uncenter/canvas-grade-calculator
// @match       https://*.instructure.com/courses/*/grades
// @include     /^https:\/\/canvas\..*\.edu\/courses\/.*\/grades/
// @grant       GM_registerMenuCommand
// @homepageURL https://github.com/uncenter/canvas-grade-calculator
// @version     0.3.1
// @author      uncenter, Liam Wirth
// @license     MIT
// ==/UserScript==

function parseCanvasDate(input) {
	if (input === '') return;

	let year = new Date().getFullYear().toString();
	let [date, time] = input.includes('by')
		? input.split(' by ')
		: input.split(' at ');
	if (date.includes(',')) {
		[date, year] = date.split(', ');
	}
	let [month, day] = date.split(' ');
	const period = time.match(/am|pm/)[0];
	let hour = time.replace(period, '');
	let minute = 0;
	if (hour.includes(':')) {
		[hour, minute] = hour.split(':');
	}

	return new Date(
		Number.parseInt(year),
		[
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec',
		].indexOf(month),
		Number.parseInt(day),
		Number.parseInt(hour) +
			(period === 'pm' && Number.parseInt(hour) !== 12 ? 12 : 0),
		Number.parseInt(minute)
	).getTime();
}

function toKebabCase(string) {
	return string
		.toLowerCase()
		.replaceAll(/\s+|_+/g, '-')
		.replaceAll(/[^\da-z-]+/g, '');
}

function downloadFile(data, filename) {
	const blob = new Blob([data], { type: 'text/plain' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function getWeights() {
	const weights = {};

	const table =
		document.querySelector('[aria-label="Grading Period Weights"]') ||
		document.querySelector('[aria-label="Assignment Weights"]');

	// Scrape weights table for category/group names and percentages.
	for (const element of table.querySelectorAll('table tbody > tr')) {
		const group = element.querySelector('th').textContent;
		if (group === 'Total') continue;
		const weight =
			Number.parseFloat(element.querySelector('td').textContent.slice(0, 2)) /
			100;
		weights[group] = weight;
	}
	console.log(weights);
	return weights;
}

function getAssignments() {
	const assignments = [];
	// Use a broader selector to include all assignment rows,
	// not just those already marked as graded.
	const assignmentRows = document.querySelectorAll(
		'#grades_summary tr.student_assignment'
	);

	for (const row of assignmentRows) {
		let earned = 0,
			available = 0,
			title = '',
			group = '';

		// Get assignment title and group from the header cell.
		const titleEl = row.querySelector('th.title');
		if (!titleEl) continue;
		title = titleEl.querySelector('a')?.textContent.trim() || '';
		group = titleEl.querySelector('div.context')?.textContent.trim() || '';

		// Parse due and submitted dates.
		const dueText = row.querySelector('.due')?.textContent.trim() || '';
		const submittedText =
			row.querySelector('.submitted')?.textContent.trim() || '';
		const due = parseCanvasDate(dueText);
		const submitted = parseCanvasDate(submittedText);

		// Get the grade container.
		const gradeEl = row.querySelector('td.assignment_score span.grade');
		if (!gradeEl) continue;

		// If the grade element shows a graded icon, use the original points.
		if (gradeEl.querySelector('.graded_icon')) {
			const op = row.querySelector('.original_points');
			earned = op ? Number.parseFloat(op.textContent.trim()) : 0;
			available = earned;
		} else {
			// For ungraded or "what-if" assignments, try to extract a score text.
			const textNode = [...gradeEl.childNodes].find(
				(node) =>
					node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
			);

			if (textNode) {
				const scoreText = textNode.textContent.trim();
				// If the score is in percentage format or available points are not parseable,
				// assume a percentage out of 100.
				if (
					scoreText.includes('%') ||
					!(
						gradeEl.nextElementSibling &&
						gradeEl.nextElementSibling.textContent.includes('/')
					)
				) {
					earned = Number.parseFloat(scoreText.replace('%', ''));
					available = 100;
				} else {
					earned = Number.parseFloat(scoreText);
					if (Number.isNaN(earned)) {
						// Fallback: attempt to read the what-if score.
						const wis = row.querySelector('.what_if_score');
						earned = wis ? Number.parseFloat(wis.textContent.trim()) : 0;
					}
					available = gradeEl.nextElementSibling
						? Number.parseFloat(
								gradeEl.nextElementSibling.textContent.replace('/', '').trim()
						  )
						: 0;
				}
			} else {
				// If no score text was found, fallback to using the what-if score
				// (or default to 0).
				const wis = row.querySelector('.what_if_score');
				earned = wis ? Number.parseFloat(wis.textContent.trim()) : 0;
				const op = row.querySelector('.original_points');
				available = op ? Number.parseFloat(op.textContent.trim()) : 0;
			}
		}

		// Determine if the assignment counts toward the final grade.
		let countsTowardFinalGrade = true;
		const ctfgEl = row.querySelector(
			'[aria-label="This assignment does not count toward the final grade."]'
		);
		if (ctfgEl) {
			countsTowardFinalGrade =
				ctfgEl.getAttribute('style') === 'visibility: hidden;';
		}

		// Process any comments.
		const comments = [];
		const commentContainer =
			row.nextElementSibling &&
			row.nextElementSibling.nextElementSibling &&
			row.nextElementSibling.nextElementSibling.nextElementSibling;
		if (commentContainer) {
			const commentTable = commentContainer.querySelector('td > table > tbody');
			if (commentTable) {
				for (const commentRow of commentTable.querySelectorAll('tr')) {
					const [commentTd, detailsTd] = commentRow.querySelectorAll('td');
					const text =
						commentTd.querySelector('span')?.textContent.trim() || '';
					let [name, ...dateParts] = detailsTd.textContent.trim().split(',');
					const date = parseCanvasDate(dateParts.join(',').trim());
					comments.push({
						text,
						name: name.trim(),
						date,
					});
				}
			}
		}

		assignments.push({
			earned,
			available,
			countsTowardFinalGrade,
			title,
			group,
			due,
			submitted,
			comments,
		});
	}
	console.log(assignments);
	return assignments;
}

function calculate() {
	const weights = getWeights();
	const assignments = getAssignments();

	if (assignments.length === 0) {
		console.warn('No graded assignments found!');
		return;
	}

	// Filter out assignments where earned or available is not a finite number.
	const validAssignments = assignments.filter(
		(a) => Number.isFinite(a.earned) && Number.isFinite(a.available)
	);

	console.log('These assignments are valid');
	console.log(validAssignments);

	/* eslint-disable unicorn/prevent-abbreviations, unicorn/no-array-reduce */
	// Build totals per group from only valid assignments.
	const totalsPerGroup = validAssignments
		.filter((assignment) => assignment.countsTowardFinalGrade)
		.reduce((acc, { group, earned, available }) => {
			acc[group] = acc[group] || { totalEarned: 0, totalAvailable: 0 };
			acc[group].totalEarned += earned;
			acc[group].totalAvailable += available;
			return acc;
		}, {});
	/* eslint-enable */

	// Calculate each group's percentage.
	const groupPercentages = {};
	for (const group in totalsPerGroup) {
		const { totalEarned, totalAvailable } = totalsPerGroup[group];
		groupPercentages[group] = totalAvailable
			? (totalEarned / totalAvailable) * 100
			: 0;
	}

	let grade = 0;
	if (Object.entries(weights).length === 0) {
		// No weights: combine all valid assignments.
		console.log('Assignment groups / categories are not weighted.');
		let totalAvailable = 0;
		let totalEarned = 0;
		for (const group of Object.values(totalsPerGroup)) {
			totalEarned += group.totalEarned;
			totalAvailable += group.totalAvailable;
		}
		grade = (totalEarned / totalAvailable) * 100;
	} else {
		// With weights, only include groups that have available points.
		let totalWeights = 0;
		for (const group in totalsPerGroup) {
			if (totalsPerGroup[group].totalAvailable > 0) {
				const groupPercentage =
					(totalsPerGroup[group].totalEarned /
						totalsPerGroup[group].totalAvailable) *
					100;
				grade += groupPercentage * weights[group];
				totalWeights += weights[group];
			}
		}
		grade = totalWeights > 0 ? grade / totalWeights : 0;
	}

	return { grade: grade.toFixed(2), assignments };
}

function exportAndDownloadAssignments(assignments) {
	const course = document.querySelector('#course_select_menu').value;
	downloadFile(
		JSON.stringify(assignments),
		toKebabCase(course) + '-assignments.json'
	);
}

function ensureOnCanvasGrades() {
	if (!document.querySelector('.ic-app-main-content')) {
		throw new Error('Not on Canvas!');
	}
	if (!document.querySelector('#grade-summary-content')) {
		throw new Error('Not on grades page!');
	}
}

GM_registerMenuCommand('Export assignments', () => {
	ensureOnCanvasGrades();
	exportAndDownloadAssignments(calculate().assignments);
});

// Calculate the initial grade and store it as the original grade.
const initialResult = calculate();
const originalGrade = initialResult ? initialResult.grade : 'N/A';

if (initialResult) {
	console.log(initialResult);
	const gradeContainer =
		document.querySelector('#student-grades-final') ||
		document.querySelector('.student_assignment.final_grade');

	// Initially, just show the total grade.
	gradeContainer.innerHTML = `
    <div>Total Grade: <span class="grade">${initialResult.grade}%</span></div>
    <button id="recalculate-grade" style="margin-top: 5px;">Recalculate What If Grade</button>
  `;

	// When the user clicks the recalc button, update the grade.
	document
		.getElementById('recalculate-grade')
		.addEventListener('click', function recalcHandler() {
			// Optionally, if the table may have been updated, you can re-read the assignments:
			// getAssignments();
			const newResult = calculate();

			// If the new what-if grade differs from the original, display the original grade line.
			if (newResult.grade !== originalGrade) {
				gradeContainer.innerHTML = `
        <div>"What-If" Grade: <span class="grade">${newResult.grade}%</span></div>
        <div class="original-grade" style="font-size: 0.8em; color: gray;">Original Grade: ${originalGrade}%</div>
        <button id="recalculate-grade" style="margin-top: 5px;">Recalculate What If Grade</button>
      `;
			} else {
				gradeContainer.innerHTML = `
        <div>Total Grade: <span class="grade">${newResult.grade}%</span></div>
        <button id="recalculate-grade" style="margin-top: 5px;">Recalculate What If Grade</button>
      `;
			}
			// Reattach the event listener since innerHTML has been replaced.
			document
				.getElementById('recalculate-grade')
				.addEventListener('click', recalcHandler);
		});
}
