# Canvas Grade Calculator

Calculate grade totals and export your assignments data for Canvas courses.

<a href="https://greasyfork.org/en/scripts/479317-canvas-grade-calculator"><img src="https://img.shields.io/badge/greasyfork-install-670000?style=for-the-badge"></a>

## Features

- 🚫 Bypasses the "Calculation of totals has been disabled" text by replacing it with your actual grade, accurately calculated to match Canvas grading.[^1]
- 💾 Export your assignments for a course as JSON:
  - Includes your `earned` points, `available` points, if the assignment `countsTowardFinalGrade`, the assignment `title`, the assignment's `group`/category, the `due` date (as number of milliseconds since Unix epoch), the `submitted` date (also the number of milliseconds since Unix epoch), and the assignment's `comments`.

## Usage

**To view your calculated grade:**

1. Nothing! Your grade is automatically inserted into the course grades page's contents.

**To export your assignments for a course:**

1. Open Canvas to the grades page for that course.
2. Open the extension popup for your userscripts manager by clicking its icon.
3. Click the "Export assignments" menu command of this userscript.

## Roadmap

- [ ] Support calculating yearly totals (all grading periods) - ⚠️ currently not possible due to what information Canvas provides.

## License

[MIT](LICENSE)

[^1]: Calculated to include weights and if the assignment counts toward your final grade. I try my best to make it as accurate as possible, though there may be edge cases. If you notice a mistake, please raise an issue on this repository to let me know!
