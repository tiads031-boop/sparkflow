# SparkFlow Study Mode Proposal

> RFC / Design Proposal
>
> Goal: introduce a dedicated learning experience on top of the existing SparkFlow architecture.

## 1. Background

SparkFlow currently provides:

- Task management
- Calendar scheduling
- Course management
- Pomodoro focus
- Planning workflow

The current system already contains many primitives required for learning scenarios. This proposal suggests adding a dedicated **Study Mode** instead of treating learning as only a task category.

## 2. Product Vision

Transform SparkFlow from a task management tool into a personal growth system.

Learning lifecycle:

```
Plan -> Learn -> Review -> Remember -> Reflect
```

## 3. Design Reference

The following nine reference images are used for the Study Mode design direction.

> Image assets will be added under:
>
> `docs/assets/study-mode-reference/`
>
> Suggested naming:
>
> - 01-today.png
> - 02-study-folders.png
> - 03-review-system.png
> - 04-learning-pages.png
> - 05-study-habits.png
> - 06-study-calendar.png
> - 07-export-report.png
> - 08-review-plan.png
> - 09-study-heatmap.png

## 4. Core Concepts

## Study Mode

Learning becomes an independent workspace.

Example:

```
SparkFlow

├── Work Mode
├── Study Mode
└── Life Mode
```

## Study Home

A learning dashboard containing:

- Today's learning tasks
- Review queue
- Learning countdown
- Study habits
- Progress summary

## Study Folder

Each learning goal has its own space.

Examples:

```
Exam Preparation
 ├── Notes
 ├── Exercises
 └── Reviews

Language Learning
 ├── Vocabulary
 ├── Reading
 └── Writing
```

## Review System

Completed learning items should generate future reviews.

Example intervals:

```
Day 1
Day 3
Day 7
Day 15
Day 30
```

## Learning Record

Track:

- Study duration
- Completed tasks
- Review count
- Continuous learning days

## 5. Technical Direction

### Frontend

Proposed module:

```
web/src/components/study/

StudyHome
StudyFolder
ReviewQueue
StudyHeatMap
StudyExport
```

### Backend

Proposed module:

```
api/src/study/

study.module.ts
study.controller.ts
study.service.ts
```

### Database

Potential entities:

### StudyFolder

Stores learning goals and spaces.

### ReviewPlan

Stores spaced repetition schedules.

### StudyRecord

Stores daily learning statistics.

## 6. Existing Feature Reuse

Study Mode should reuse existing capabilities:

- Task
- CalendarEvent
- Course
- PomodoroSession

No new task type should be introduced initially.

Existing `study` task classification can become the foundation.

## 7. Implementation Roadmap

### Phase 1: Study Workspace

- Study Mode entry
- Study dashboard
- Study folders
- Study task integration

### Phase 2: Learning Loop

- Review plans
- Study history
- Heat map
- Habit tracking

### Phase 3: Intelligence

- AI learning planner
- Automatic study schedules
- Learning reports

## 8. Non Goals

Initial version will not include:

- Social learning network
- Content marketplace
- Full AI tutor replacement

## 9. Expected Result

The goal is not to create another todo list.

The goal is to help users manage the complete process of learning and growth.
