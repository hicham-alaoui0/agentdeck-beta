# AgentDeck

**A little island at the top of your Windows screen that keeps an eye on your AI
coding agents** (Claude Code and Codex), so you don't have to keep checking
terminal tabs.

**[Website](https://hicham-alaoui0.github.io/agentdeck-beta/)** ·
**[Download for Windows](https://github.com/hicham-alaoui0/agentdeck-beta/releases/latest/download/AgentDeck_x64-setup.exe)** ·
**[Report a problem](https://github.com/hicham-alaoui0/agentdeck-beta/issues/new/choose)**

- **See every session at a glance.** Each running agent gets a little character
  on the island: working, waiting for you, done, or resting at a usage limit.
- **Answer from one place.** Permission requests and multiple-choice questions
  drop down from the island. Allow, deny, or answer without finding the right
  terminal.
- **Reply when an agent finishes.** Type its next instruction on the island.
- **Know when it matters.** Risky requests are flagged with a reason, critical
  ones need a deliberate hold to allow, and long commands tell you when they end.
- **Usage at a glance.** Your Claude and Codex limits, with a nudge at 80% and 95%.

Windows 10 and 11 (x64). Free while in beta.

## Install

1. Download **[AgentDeck_x64-setup.exe](https://github.com/hicham-alaoui0/agentdeck-beta/releases/latest/download/AgentDeck_x64-setup.exe)**
   (always the latest release; older ones are under [Releases](https://github.com/hicham-alaoui0/agentdeck-beta/releases)).
2. Double-click it. The beta isn't code-signed yet, so Windows may say
   **"Windows protected your PC"**: click **More info → Run anyway**.
3. It installs for your user only (no admin rights) and opens a short setup
   guide that connects Claude Code and Codex.

Seeing sessions needs no setup. Answering from the island needs AgentDeck's
hooks, which the setup guide adds (with a backup of your settings first). In
Codex, run `/hooks` and trust AgentDeck's hooks, then restart Codex.

## Privacy

Everything stays on your PC: no telemetry, no analytics, no accounts.
AgentDeck makes no network calls of its own; the only exception is the optional
CI status, which uses your own GitHub CLI and is off by default.
[Privacy policy](https://hicham-alaoui0.github.io/agentdeck-beta/privacy.html).

## Feedback

In the AgentDeck window, **Send feedback** opens this repository's issue forms.
Please attach the diagnostic bundle (Setup → Diagnostics → Export): it has
versions and settings, but no commands, code, prompts or file paths.

## License

AgentDeck is free to use during the beta but not open source: see the
[license agreement](LICENSE.txt). This repository holds releases, the website
and issues; the source code is private.

AgentDeck is an independent tool, not affiliated with or endorsed by Anthropic
or OpenAI. Claude and Claude Code are trademarks of Anthropic; OpenAI and Codex
are trademarks of OpenAI.
