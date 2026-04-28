# BubbleBreak
Ice-breaking Web App for Finding Common Interests

BubbleBreak is an interactive web app that helps people start conversations by discovering shared interests through a bubble-based game flow.

It was built as a lightweight full-stack project with a React frontend and a Cloudflare Workers + D1 backend, focusing on a smooth social experience, simple room-based interaction, and practical serverless deployment.

---

# 🇺🇸 English

## Overview

**BubbleBreak** is a web-based ice-breaking service designed for situations where people need help starting conversations naturally.

Instead of relying on awkward introductions, users join the same room, create interest bubbles, and interact with each other's topics. As bubbles are opened, participants can discover shared interests and continue the conversation from something real and personal.

This project focuses on:

- building an interactive social experience with a clear game-like flow
- designing room-based multiplayer interaction for small groups
- deploying the frontend and backend together on Cloudflare's serverless platform
- keeping the request flow lightweight for practical demo and edge deployment usage

---

## Key Features

- room-based multiplayer flow with join, ready, start, and finish states
- interactive bubble UI for exploring other participants' interests
- common-interest discovery flow for natural conversation starters
- cookie-based session handling for lightweight room participation
- Cloudflare Worker + D1 architecture with static web asset deployment
- responsive React UI optimized for simple mobile-first interaction

---

## Architecture

BubbleBreak is organized as a small monorepo:

```text
BubbleBreak
├── apps
│   ├── web
│   │   ├── src
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── worker
│       ├── src
│       ├── package.json
│       └── wrangler.jsonc
├── packages
│   └── shared
├── package.json
└── README.md
```

### Web

- built with React, TypeScript, and Vite
- handles lobby, bubble field, recommendation flow, and session-based user experience

### Worker

- runs on Cloudflare Workers
- serves API routes and static web assets together
- uses D1 for room, participant, event, and session-related data

---

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **Cloudflare Workers**
- **Cloudflare D1**
- **Hono**

---

## What Makes This Project Interesting

- combined frontend and backend deployment into a unified Cloudflare Worker-based architecture
- implemented room lifecycle logic including participant sync, ready state, gameplay state, and event handling
- designed a lightweight session flow using cookies instead of a heavy authentication system
- optimized request-heavy polling behavior for demo-friendly serverless operation
- built around a social interaction problem, not just a CRUD interface

---

## Use Cases

BubbleBreak can be used in situations where people need a more natural way to begin conversations:

- team building sessions
- university orientation programs
- networking events
- workshops and seminars
- small group community activities

---

# 🇰🇷 한국어

## 프로젝트 개요

**BubbleBreak**는 사람들이 처음 만나는 어색한 상황에서  
**공통 관심사를 발견하며 자연스럽게 대화를 시작할 수 있도록 돕는 웹 서비스**입니다.

사용자는 같은 방에 들어와 자신의 관심사를 버블 형태로 구성하고,  
다른 참가자의 버블을 확인하면서 서로의 공통점을 찾아갑니다.  
단순한 자기소개 대신, 실제 관심사를 기반으로 대화를 시작할 수 있도록 설계했습니다.

이 프로젝트는 다음에 집중했습니다.

- 게임처럼 가볍고 직관적인 아이스브레이킹 UX 설계
- 소규모 그룹을 위한 room 기반 멀티유저 흐름 구현
- Cloudflare Workers + D1 기반의 서버리스 전체 구조 구성
- 데모 및 실제 운영을 고려한 가벼운 요청 구조 최적화

---

## 주요 기능

- 방 생성, 참여, 준비완료, 시작, 종료로 이어지는 room 기반 흐름
- 다른 참가자의 관심사를 확인하는 버블 인터랙션 UI
- 공통 관심사를 자연스럽게 발견하게 하는 대화 유도 구조
- cookie 기반 세션 처리로 간단한 사용자 참여 관리
- Worker에서 API와 정적 웹 자산을 함께 배포하는 구조
- 모바일 중심으로 사용하기 쉬운 반응형 React UI

---

## 구조

BubbleBreak는 작은 모노레포 형태로 구성되어 있습니다.

```text
BubbleBreak
├── apps
│   ├── web
│   │   ├── src
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── worker
│       ├── src
│       ├── package.json
│       └── wrangler.jsonc
├── packages
│   └── shared
├── package.json
└── README.md
```

### Web

- React, TypeScript, Vite 기반 프론트엔드
- 로비, 버블 필드, 추천/공통관심사 흐름 등의 사용자 화면 담당

### Worker

- Cloudflare Workers 기반 백엔드
- API와 정적 웹 자산을 함께 서빙
- D1을 사용해 방, 참가자, 이벤트, 세션 데이터를 관리

---

## 기술 스택

- **React**
- **TypeScript**
- **Vite**
- **Cloudflare Workers**
- **Cloudflare D1**
- **Hono**

---

## 이 프로젝트의 강점

- 프론트와 백엔드를 Cloudflare Worker 중심으로 통합 배포하는 구조를 직접 구성함
- room lifecycle, participant sync, ready state, event 흐름 등 멀티유저 상태 관리를 구현함
- 무거운 인증 대신 cookie session 기반으로 간결한 참여 구조를 설계함
- polling 중심 요청 구조를 서버리스 환경에 맞게 최적화함
- 단순 CRUD가 아니라 실제 사회적 상호작용 문제를 풀기 위한 UX를 구현함

---

## 활용 가능 분야

- 아이스브레이킹 활동
- 네트워킹 이벤트
- 대학 오리엔테이션
- 교육 프로그램
- 팀 빌딩 프로그램
- 소규모 커뮤니티 모임

---

## License

This project was created as a personal project for exploring interactive social UX, lightweight multiplayer flow, and serverless full-stack deployment.
