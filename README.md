# FetchPlay

**FetchPlay** is a browser-based **API client** for building, sending, and debugging HTTP requests without a backend or login. It is inspired by tools like Postman, but runs entirely in the **client**: all data lives in **localStorage**, and every call uses the browser’s **`fetch` API**.

This document describes features, architecture, data formats, and how to run or deploy the app.

---

## Table of contents

1. [What FetchPlay is (and is not)](#what-fetchplay-is-and-is-not)
2. [Tech stack](#tech-stack)
3. [Feature overview](#feature-overview)
4. [User interface layout](#user-interface-layout)
5. [Requests: REST and GraphQL](#requests-rest-and-graphql)
6. [Authentication](#authentication)
7. [Environments and variables](#environments-and-variables)
8. [Collections and import / export](#collections-and-import--export)
9. [Request history](#request-history)
10. [Request chains](#request-chains)
11. [AI assistant](#ai-assistant)
12. [Persistence (localStorage)](#persistence-localstorage)
13. [Project structure](#project-structure)
14. [Getting started (development)](#getting-started-development)
15. [Building for production](#building-for-production)
16. [Deployment](#deployment)
17. [Keyboard shortcuts and UX](#keyboard-shortcuts-and-ux)
18. [Limitations and browser behavior](#limitations-and-browser-behavior)
19. [Comparison with Postman (high level)](#comparison-with-postman-high-level)

---

## What FetchPlay is (and is not)

| FetchPlay **is** | FetchPlay **is not** |
|------------------|----------------------|
| A single-page **React** app (no server required for the UI) | A hosted “API platform” with accounts and cloud sync |
| **REST** and **GraphQL** over `fetch` | gRPC, WebSocket, or SOAP clients (not implemented) |
| **Collections**, **environments**, **history**, and **chains** stored **locally** | Team workspaces, public API network, or built-in mock servers |
| **Import** of **Postman Collection v2.1** and **Postman environment** JSON (with limitations) | A 1:1 replacement for every Postman feature (see [Limitations](#limitations-and-browser-behavior)) |

There is **no authentication** to use the app itself. Optional **Anthropic (Claude)** API calls for the AI panel require an API key you enter in the UI (stored locally).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | **React 19** |
| Build / dev | **Vite 8** |
| Styling | **Tailwind CSS 4** (via `@tailwindcss/vite`) |
| Resizable layout | `react-resizable-panels` (`Group`, `Panel`, `Separator`) |
| Code editing | **CodeMirror 6** (`@uiw/react-codemirror`, JSON + JS modes for body / GraphQL query) |
| Toasts | `sonner` |
| Icons | `lucide-react` |
| Crypto (signatures) | `crypto-js` (e.g. MD5 for custom auth) |

---

## Feature overview

- **Three-panel layout**: collections & history (left), request builder (center), response viewer (right); panels are **resizable**.
- **Dark theme** by default (`#0f0f0f` / `#111827` backgrounds).
- **REST**: methods `GET`, `POST`, `PUT`, `PATCH`, `DELETE`; URL; tabs for **Params**, **Headers**, **Body**, **Auth**.
- **GraphQL**: same URL bar with mode toggle; **POST** with JSON body `{ "query", "variables" }`; query and variables editors.
- **Query params** as key/value rows; merged into the URL.
- **Headers** with per-row **enable/disable**.
- **Body**: raw text with JSON-oriented editor; variables resolved before send.
- **Environments**: multiple named sets; **initial** vs **current** values; **secret** flag; import **Postman** or **FetchPlay-native** environment JSON; export (initial values only, to avoid leaking session overrides).
- **Collections**: create/rename/delete folders; save **requests** and **chains**; export / import JSON; optional embedded environments on import.
- **History**: last **50** requests with method, URL, status, timestamp, active environment name.
- **Chains**: ordered steps; `{{stepN.response...}}` references; optional “run next only if …” on previous response; run results shown per step.
- **Variable preview**: under URL and body, shows **resolved** vs **unresolved** placeholders.
- **AI help**: natural language to **build** a request, **explain** a response, or **suggest** fixes for errors (Claude API).
- **Toasts** for success / error on major actions.

---

## User interface layout

1. **Top bar**  
   - **FetchPlay** brand  
   - **Active environment** dropdown  
   - **Environments** (modal)  
   - **AI Help** (drawer)  
   - **New Chain** (opens chain builder)  
   - Hint: **Ctrl+Enter** to send the current request (main view)

2. **Left sidebar**  
   - **Collections** (create collection, add items, import file, export per collection)  
   - **History** (restore request, clear history)

3. **Center**  
   - REST/GraphQL toggle, method (REST), URL, **Send**  
   - Request tabs: params / headers / body / auth (GraphQL: headers, auth, query & variables)

4. **Right**  
   - Status, timing, size  
   - Pretty / raw / response headers  
   - Copy; **Use in chain** (after success) on the main request flow

---

## Requests: REST and GraphQL

### REST

- **Params** are appended to the URL as a query string (only enabled rows with a non-empty key).
- **Body** is sent for methods that typically carry a body. If you enter a body on **GET** (unusual), the app can attach it and set `Content-Type` when needed—many servers ignore GET bodies; prefer the method the API documents (often **POST** for list/search endpoints).
- **GraphQL mode** forces **POST** and JSON body with `query` and parsed `variables`.

### Variable substitution

Before the request is sent, placeholders in URL, param values, header values, body, GraphQL query/variables, and certain auth fields are resolved using:

- The **active environment** (and **Globals**), and
- If applicable, a **chain context** (see [Request chains](#request-chains)).

Syntax: `{{NAME}}` for environment variables, or `{{step1.response...}}` for chain references.

---

## Authentication

Supported **Auth** types in the request builder:

| Type | Behavior |
|------|----------|
| **None** | No extra auth headers. |
| **Bearer Token** | `Authorization: Bearer <token>`. |
| **API Key** | Header or query param (configurable name + placement). |
| **Basic Auth** | `Authorization: Basic` with Base64 of `user:password`. |
| **Merchant signature** (custom) | For APIs that need MD5-based `sign`, `user`, `timestamp`, and `token` headers—aligned with a common pattern from some imported Postman collections. Values can include `{{variables}}`. |

`Authorization` / custom headers from Auth are combined with the **Headers** table (and signature headers) at send time.

---

## Environments and variables

### Concepts

- Each **environment** has a name (including a special **Globals** list).
- Each variable: **name**, **initial value** (exported, committed), **current value** (session override, **never exported**), **secret** (mask in UI).
- **Active environment** is selected in the top bar; a saved item can store a **default environment** name.

### Resolution order (highest to lowest)

1. **Current** value in the **active** environment  
2. **Initial** value in the **active** environment  
3. **Current** value in **Globals**  
4. **Initial** value in **Globals**  
5. If still missing, the placeholder stays unresolved (highlighted, with a “variable not found” style in preview)

Circular references between variables are detected where applicable.

### Import

- **Postman environment** JSON (`name` + `values[]` with `key` / `value` / `enabled`)
- **FetchPlay-native** JSON (`format: "api-playground-environment"`)  
  *Note: export format id is still `api-playground-*` for backward compatibility.*

On conflict with an existing name, the environment manager can **merge**, **replace**, or **keep both** (per flow in the UI).

### Export

- **Single** or **all** environments: **initial values only** (and metadata like `secret` flag for structure—not live secrets from “current” overrides).

---

## Collections and import / export

- **Create / rename / delete** collections; **save** the current request or a chain into a collection.
- **Export** downloads a JSON file. Exports can include an **`embeddedEnvironments`** block (initial values) for sharing with a collection.
- **Import** accepts:
  - **FetchPlay** collection JSON (`format: "api-playground-collection"`, `items` array), or
  - **Postman Collection v2.1**-style JSON (`info` + `item` tree) — flattened to individual requests; nested folders become a flat list of requests; some Postman-only features (scripts) are not executed—see [Limitations](#limitations-and-browser-behavior).

On import, if **embedded environments** are present, you can choose which to merge in and how to handle name collisions.

---

## Request history

- Up to **50** entries, stored in localStorage.
- Each entry stores a snapshot of the request, response status, URL, timestamp, and **active environment** name.
- **Clear** removes all history entries (destructive; no undo beyond reloading if not saved).

---

## Request chains

### Purpose

A **chain** is a **sequence of requests** that run in order. Later steps can reference data returned from earlier steps.

### UI

- **New Chain** opens the builder (optionally seeded from the current request).  
- **Use in chain** (after a successful response in the main view) seeds a new chain with the current request as **Step 1**.

### Reference syntax (after `response`)

Placeholders use the form:

```text
{{step1.response.body.<path>}}
{{step1.response.headers.<name>}}
{{step1.response.status}}
```

- **Paths** use `.` and support **array indices** with either `list[0].id` or `list.0.id` style segments.
- If the JSON has a **nested** object (e.g. a top-level `data` or `result` field), the path must include those keys—`step1.response.body` is the parsed JSON **root** of the response body, not a literal key unless your API uses a property literally named in your document.

### Conditions

For step 2 onward, you can require that the **previous** response satisfies a condition (e.g. `status == 200`, or `response.body.success == true` style) before the next step runs.

### Running

- **Run chain** executes steps sequentially. On failure (network, HTTP, or condition), the chain **stops** and shows which step failed, with **partial** `chainContext` for debugging previews where implemented.

### Saving

Chains can be **saved into collections** like any other item (type `chain` with `steps`).

---

## AI assistant

- **Panel**: **AI Help** in the top bar.  
- **API key**: Anthropic **Claude** API key; stored in localStorage (`api_playground_ai_key`).  
- **Model** (in code): `claude-sonnet-4-20250514`.  
- **Direct browser** header: `anthropic-dangerous-direct-browser-access` (required for browser-side calls to Anthropic’s API).
- Modes: **build request** (fills the builder), **explain response** (context = last response), **debug error** (context = current error object).

**Privacy note:** the key and prompts go to **Anthropic** when you use this feature; no FetchPlay server sits in the middle.

---

## Persistence (localStorage)

| Key | Purpose |
|-----|---------|
| `api_playground_collections` | All collections and items (requests + chains). |
| `api_playground_history` | Last 50 history records. |
| `api_playground_environments` | Environment definitions and **initial** variable values. |
| `api_playground_env_current` | **Current** (local override) values per environment. |
| `api_playground_active_env` | Name of the currently selected environment. |
| `api_playground_ai_key` | Optional Claude API key for AI Help. |

Names retain the `api_playground_*` prefix for **compatibility** with early versions and exports; the product name is **FetchPlay**.

**Clearing site data** in the browser removes all of the above.

---

## Project structure

```text
src/
├── App.jsx                 # Layout, panels, global state wiring
├── main.jsx
├── index.css               # Tailwind + global styles
├── components/
│   ├── Sidebar.jsx
│   ├── RequestBuilder.jsx
│   ├── ResponseViewer.jsx
│   ├── GraphQLEditor.jsx
│   ├── KeyValueTable.jsx
│   ├── VariablePreviewBar.jsx
│   ├── ChainBuilder.jsx
│   ├── EnvironmentManager.jsx
│   └── AIAssistant.jsx
├── hooks/
│   ├── useCollections.js
│   ├── useHistory.js
│   ├── useRequest.js       # build URL/headers/body, send, errors
│   ├── useChain.js
│   └── useEnvironments.js
└── utils/
    ├── storage.js
    ├── formatter.js
    └── variableResolver.js
public/
├── favicon.svg
└── _redirects              # SPA fallback (Netlify / static hosts)
Dockerfile, nginx.conf      # Optional container image
netlify.toml, vercel.json   # Optional static host config
```

---

## Getting started (development)

**Requirements:** Node.js 18+ (or current LTS recommended) and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**Lint** (if configured):

```bash
npm run lint
```

---

## Building for production

```bash
npm run build
```

Output is in **`dist/`** — static files only, suitable for any static file host.

```bash
npm run preview
```

Serves the production build locally for a quick smoke test.

---

## Deployment

- **Static hosting (recommended for this app):** upload **`dist/`** or connect CI to `npm run build` and publish `dist/`.
  - `public/_redirects` and `netlify.toml` / `vercel.json` help with **SPA fallback** (all routes → `index.html`) where supported.
- **Docker:** a multi-stage `Dockerfile` builds with Node and serves with **nginx**; see the file and `nginx.conf` in the repository root.

There is no mandatory backend; ensure **CORS** on your APIs allows your **deployment origin** if you call third-party HTTP APIs from the browser.

---

## Keyboard shortcuts and UX

| Action | Shortcut |
|--------|----------|
| **Send** current request (main app) | **Ctrl+Enter** |

Toasts (Sonner) report major successes and errors (import, send, save, clear, etc.).

---

## Limitations and browser behavior

1. **CORS**  
   Browsers block cross-origin responses unless the target server sends appropriate **Access-Control-Allow-Origin** (and related) headers. Native apps like **Postman** are not subject to the same rules. If a call works in Postman but not in FetchPlay, CORS is a common cause.

2. **Postman scripts**  
   Postman **Pre-request** and **Test** scripts (JavaScript, `pm.*`, etc.) are **not** re-executed. Imports map requests and a **subset** of behavior (e.g. certain auth / signature patterns); complex automation should be simplified or run in Postman/Newman.

3. **Secrets**  
   “Current” environment values and AI keys are **local**. Never commit real secrets into exported JSON if you use initial values for real credentials—use secrets carefully.

4. **Large payloads**  
   Very large bodies and responses can stress the tab; there is no streaming UI.

5. **Format IDs**  
   Collection/environment JSON may still use `api-playground-*` **format** strings in files for **compatibility**; the application name is **FetchPlay**.

---

## Comparison with Postman (high level)

| Topic | Postman (typical) | FetchPlay |
|--------|--------------------|-----------|
| **Account & sync** | Optional cloud, teams, sharing | **None**; all local in the browser |
| **Runtime** | Desktop app, optional web, CLI (Newman) | **Single-page web app**; `fetch` only |
| **Scripting** | Rich pre-request and test scripts | **No** full script engine; chains + custom auth + variables |
| **Collection runner** | Data files, iterations, full control | **Chains** with sequential steps and simple conditions |
| **Protocols** | Many (HTTP, GraphQL, WebSocket, gRPC, …) | **HTTP/HTTPS** + **GraphQL** over JSON POST |
| **CORS** | Not applicable in desktop the same way | **Applies** to all cross-origin API calls from the site |

Use FetchPlay when you want a **lightweight, private, no-login** request workspace in the browser. Use Postman (or similar) for **full API lifecycle** features, team collaboration, and full scripting.

---

## License

This project is private in its current form; add a `LICENSE` file if you distribute it publicly.
