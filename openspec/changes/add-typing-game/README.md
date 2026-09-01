# add-typing-game

遊戲中心新增 TYPING 打字遊戲：畫面持續生成單字，玩家鍵盤逐字元輸入（不分大小寫），輸入正確的字元即時顯示、打完整個字後往上飄消失並得分，隨時間生成更快、單字更難；未打完飄出畫面頂端算 MISS、扣一條命，3 條命歸零結束。比照既有十二款遊戲的架構擴充，遊戲邏輯與 SPACE SHOOTER／SPACE INVADERS 一樣是 tick-driven inline class，不額外拆 `app/utils/` 檔案。
