// ItemManager/index.js (クラッシュ対策・最終安全版)

// --- 設定 ---
const SETTINGS_FILE = "config/ItemManagerSettings.json";
const LOCK_KEY = Keyboard.KEY_L;

// --- グローバル変数 ---
let settings = { lockedSlots: [], bindings: {} };
let isBinding = false;
let sourceSlotToBind = null;

// --- 関数の定義 ---
function loadSettings() {
    if (FileLib.exists(SETTINGS_FILE)) {
        try {
            const fileContent = FileLib.read(SETTINGS_FILE);
            const loadedSettings = JSON.parse(fileContent);
            settings.lockedSlots = loadedSettings.lockedSlots || [];
            settings.bindings = loadedSettings.bindings || {};
            ChatLib.chat("&a[ItemManager] &f設定を読み込みました。");
        } catch (e) {
            ChatLib.chat("&c[ItemManager] &f設定ファイルの読み込みに失敗しました。");
            settings = { lockedSlots: [], bindings: {} };
        }
    }
}

function saveSettings() {
    FileLib.write(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function isSlotLocked(slotIndex) {
    return settings.lockedSlots.includes(slotIndex);
}

function stopBindingMode() {
    if (isBinding) {
        isBinding = false;
        sourceSlotToBind = null;
        ChatLib.chat("&c[ItemManager] &fバインドモードを中断しました。");
    }
}

// --- 初期化処理 ---
loadSettings();

// --- コマンド登録 ---
register("command", (arg1) => {
    const command = arg1 ? arg1.toLowerCase() : "";

    switch (command) {
        case "bind":
            isBinding = true;
            sourceSlotToBind = null;
            ChatLib.chat("&a[ItemManager] &fバインドモードを開始します。");
            ChatLib.chat("&e1. &f入れ替え元のインベントリスロットをクリックしてください。");
            break;
        case "clearbinds":
            settings.bindings = {};
            saveSettings();
            ChatLib.chat("&a[ItemManager] &fすべてのバインドを解除しました。");
            break;
        case "clearlocks":
            settings.lockedSlots = [];
            saveSettings();
            ChatLib.chat("&a[ItemManager] &fすべてのロックを解除しました。");
            break;
        case "list":
            ChatLib.chat("&a[ItemManager] &f現在の設定:");
            ChatLib.chat("&eロック中のスロット: &f" + (settings.lockedSlots.length > 0 ? settings.lockedSlots.join(", ") : "なし"));
            ChatLib.chat("&eバインド一覧:");
            if (Object.keys(settings.bindings).length === 0) {
                ChatLib.chat("&7- なし");
            } else {
                for (const source in settings.bindings) {
                    const target = settings.bindings[source];
                    ChatLib.chat(`&7- &fインベントリ &e${source} &7<-> &fホットバー &e${parseInt(target) + 1}`);
                }
            }
            break;
        default:
            ChatLib.chat("&f--- &aItemManager ヘルプ &f---");
            ChatLib.chat("&e/itemmanager bind &7- スロットのバインドを開始します。");
            ChatLib.chat("&e/itemmanager clearbinds &7- すべてのバインドを解除します。");
            ChatLib.chat("&e/itemmanager clearlocks &7- すべてのロックを解除します。");
            ChatLib.chat("&e/itemmanager list &7- 現在の設定一覧を表示します。");
            ChatLib.chat("&bロック/アンロック: &fインベントリ内で &eLキー &fを押しながらスロットをクリック");
            break;
    }
}).setName("itemmanager");

// --- GUI操作のトリガー ---
register("guiMouseClick", (x, y, button, gui, event) => {
    // 安全のため、GUIやスロットが存在しない場合は即座に処理を中断
    if (!gui || !Client.currentGui.get() || !Client.currentGui.getSlotUnderMouse()) return;
    
    const slot = Client.currentGui.getSlotUnderMouse();
    const slotIndex = slot.getIndex();
    
    const isSwapAction = Keyboard.isKeyDown(Keyboard.KEY_LSHIFT) && button === 0 && settings.bindings.hasOwnProperty(slotIndex);

    if (Keyboard.isKeyDown(LOCK_KEY)) {
        cancel(event);
        if (isSlotLocked(slotIndex)) {
            settings.lockedSlots = settings.lockedSlots.filter(s => s !== slotIndex);
            ChatLib.chat(`&a[ItemManager] &fスロット &e${slotIndex} &fをアンロックしました。`);
        } else {
            settings.lockedSlots.push(slotIndex);
            ChatLib.chat(`&a[ItemManager] &fスロット &e${slotIndex} &fをロックしました。`);
        }
        saveSettings();
        return;
    }

    if (isBinding) {
        cancel(event);
        if (isSlotLocked(slotIndex)) {
            ChatLib.chat(`&c[ItemManager] &fスロット &e${slotIndex} &fはロックされているため、バインドできません。`);
            return;
        }

        if (sourceSlotToBind === null) {
            if (slotIndex >= 9 && slotIndex <= 35) {
                sourceSlotToBind = slotIndex;
                ChatLib.chat(`&a[ItemManager] &f入れ替え元スロット(&e${sourceSlotToBind}&f)を選択しました。`);
                ChatLib.chat("&e2. &f次に入れ替え先の&cホットバー&fのスロットをクリックしてください。");
            } else {
                ChatLib.chat("&c[ItemManager] &fインベントリ内のスロットを選択してください。(ホットバー、防具スロット以外)");
            }
        } else {
            if (slotIndex >= 36 && slotIndex <= 44) {
                const hotbarSlot = slotIndex - 36;
                settings.bindings[sourceSlotToBind] = hotbarSlot;
                saveSettings();
                ChatLib.chat(`&a[ItemManager] &fバインド完了: インベントリ(&e${sourceSlotToBind}&f) <-> ホットバー(&e${hotbarSlot + 1}&f)`);
                isBinding = false;
                sourceSlotToBind = null;
            } else {
                ChatLib.chat("&c[ItemManager] &f入れ替え先はホットバーのスロットを選択してください。");
            }
        }
        return;
    }
    
    // スワップ処理
    if (isSwapAction) {
        cancel(event);
        const hotbarSlotNumber = settings.bindings[slotIndex];
        
        // ★★★ クラッシュ防止ブロック ★★★
        try {
            Client.getMinecraft().field_71442_b.func_78753_a(
                Player.getContainer().getWindowId(),
                slotIndex,
                hotbarSlotNumber,
                2,
                Player.getPlayer()
            );
        } catch (e) {
            // エラーが発生した場合、クラッシュせずにチャットとコンソールにメッセージを出す
            ChatLib.chat("&c[ItemManager] &lエラー: &cアイテムのスワップに失敗しました。");
            ChatLib.chat("&c他のMODとの競合が考えられます。");
            console.log("--- ItemManager Swap Error ---");
            console.log(e);
            console.log("----------------------------");
        }
        return;
    }
    
    if (isSlotLocked(slotIndex)) {
        cancel(event);
        return;
    }
});

// GUI関連の他のトリガー
register("key", (key, event) => {
    if (!Client.currentGui.get()) return;
    if (key === Keyboard.KEY_Q && isSlotLocked(Player.getHeldItemIndex() + 36)) {
        cancel(event);
    }
}).setPriority(Priority.HIGHEST);

register("guiClosed", () => {
    stopBindingMode();
});

register("renderSlot", (slot) => {
    if (isSlotLocked(slot.getIndex())) {
        Renderer.drawRect(Renderer.color(255, 0, 0, 100), slot.getDisplayX(), slot.getDisplayY(), 16, 16);
    }
});