# 📌 TODO.md — Babaloo Bot Development Notes

A roadmap + brainstorming file for the Babaloo Discord bot.

---

# 🧩 1. Major Features To Implement
- [ ] Figure out how to test bot features without having it go offline each time.

## 🎁 Daily Rewards System (Level-Scaled)
- [ ] Implement level-tiered daily rewards:
  - **Levels 1–10:** 50 XP, 100 gold  
  - **Levels 11–20:** 75 XP, 150 gold  
- [ ] Add more reward tiers:
  - [ ] Levels 21–30  
  - [ ] Levels 31–50  
- [ ] Add streak system:
  - [ ] Daily streak bonus multiplier  
  - [ ] Weekly streak reward  
- [ ] Add cooldown timestamps to prevent abuse  
- [ ] Add daily reward embed (visual UI)

---

## 🗨️ Channel Permissions & Behavior
- [ ] Allow server admins to control which channels Babaloo can respond in  
- [ ] Support two modes:
  - **Inclusion mode:** Respond only in allowed channels  
  - **Exclusion mode:** Respond in all except excluded channels  
- [ ] Level-up message behavior:
  - [ ] Send level-up messages to a specific channel  
  - [ ] Send in the same channel message was sent  
  - [ ] Option to disable level-up messages  
- [ ] Add slash command `/babaloo channels` for configuration  

---

## 🏅 Leaderboard Filtering & Exclusions
- [ ] Exclude the following from leaderboards:
  - Admins  
  - Developers  
  - Modera

## Admin and Mods
- [ ] Admins and mods have to choose between gifting currency personally or rewards. Personal currency from stuff such as trades do not count towards leaderboard.

## Balancing features
- [ ] Ranked season only counts what is gained during that season not current total on account. Ex: If you have 100k total but only 30k out of 100k was earned in the current season, the wealth rank of user for that season is 30k. 
- [ ] Gifted currency outside of rewards for completing tasks or events as well as personal trades do not count towards currency earned
