// =======================================================
// 1. 初期設定・ペルソナ設定（簡潔回答重視版）
// =======================================================

const SYSTEM_PROMPT = [
    "あなたは、介護現場の状況を熟知したベテランの介護リーダーです。",
    "質問者は現場で働く介護スタッフです。スタッフからの質問に対して、以下のルールで回答してください。",
    "【回答の指針】",
    "1. 質問に対して、まずは結論から『簡潔に』回答してください。冗長な解説は避けてください。",
    "2. スタッフから具体的な『アドバイス』や『指示』を求められない限り、余計な助言は控えてください。",
    "3. 利用者の記録がある場合は、その事実に基づいた内容を優先して伝えてください。",
    "4. 口調は丁寧でプロフェッショナルなリーダーとして振る舞い、HTMLの<br>タグで読みやすく整形してください。"
].join('\n');

/**
 * 以下の関数やイベントハンドラは変更ありませんが、
 * プロンプトの変更を反映させるためにこの script.js を上書きしてください。
 */

function getCurrentUserName() { return "山田太郎"; }

function appendMessage(sender, message) {
    const chatWindow = $('#chat-window');
    const messageClass = sender === 'user' ? 'user-message' : sender === 'ai' ? 'ai-message' : 'system-message';
    let messageHtml = '';
    if (sender === 'ai') {
        messageHtml = `<div class="${messageClass}" style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 15px;"><img src="./images/AI.gif" alt="AI" style="height: 35px; width: 35px; border-radius: 50%; border: 1px solid #ddd;"><div style="background: #eef4ff; padding: 12px; border-radius: 15px; color: #333; line-height: 1.6; max-width: 80%; border: 1px solid #cce0ff;">${message}</div></div>`;
    } else if (sender === 'user') {
        messageHtml = `<div class="${messageClass}" style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 10px;"><div style="background: #f0f0f0; padding: 10px; border-radius: 12px; color: #333; max-width: 70%;">${message}</div><img src="./images/Q.png" alt="Q" style="height: 25px; width: 25px;"></div>`;
    } else {
        messageHtml = `<div class="${messageClass}" style="text-align: center; margin: 10px 0; color: gray; font-size: 0.85em;">--- ${message} ---</div>`;
    }
    chatWindow.append(messageHtml);
    chatWindow.scrollTop(chatWindow[0].scrollHeight);
}

// ---------------------------------------------------
// 2. MySQL / PHP 連携関数
// ---------------------------------------------------

async function fetchClients() {
    try {
        const response = await axios.get('db_action.php?action=fetch_clients');
        const clients = response.data;
        $('#client-select').empty().append('<option value="">（選択なし：一般相談）</option>');
        $('#record-client-select').empty().append('<option value="" disabled selected>利用者を選択してください</option>');
        clients.forEach(c => {
            const option = `<option value="${c.id}" data-name="${c.client_name}">${c.id}: ${c.client_name}</option>`;
            $('#client-select').append(option);
            $('#record-client-select').append(option);
        });
    } catch (error) { console.error(error); }
}

async function handleGeminiRequest(userQuestion, clientInfo) {
    appendMessage('system', 'AIが確認中です...');
    let context = "";
    if (clientInfo && clientInfo.id) {
        try {
            const isRecentQuery = /様子|調子|最近|近況|今日|昨日|変化/.test(userQuestion);
            const limit = isRecentQuery ? 6 : 30;
            const historyRes = await axios.get(`db_action.php?action=get_client_history&client_id=${clientInfo.id}&limit=${limit}`);
            const history = historyRes.data;
            if (history && history.length > 0) {
                context = `【${clientInfo.name} 様の直近の状況】\n`;
                history.forEach(r => { context += `- ${r.recorded_at}: ${r.content}\n`; });
                context += "\n上記記録に基づき、質問にのみ簡潔に回答してください。指示がない限りアドバイスは不要です。\n\n";
            }
        } catch (e) { console.error(e); }
    }
    try {
        const response = await axios.post('api.php', {
            question: context + "スタッフからの質問: " + userQuestion, 
            clientName: clientInfo ? clientInfo.name : "未指定",
            systemPrompt: SYSTEM_PROMPT 
        });
        $('.system-message:last').remove(); 
        if (response.data.answer) appendMessage('ai', response.data.answer); 
    } catch (error) { $('.system-message:last').remove(); appendMessage('ai', "エラーが発生しました。"); }
}

// ---------------------------------------------------
// 3. イベントハンドラ
// ---------------------------------------------------

$(document).ready(function() {
    fetchClients();

    $('#chat-form').on('submit', function(e) {
        e.preventDefault();
        const selectedOption = $('#client-select option:selected');
        const clientId = selectedOption.val();
        const clientInfo = clientId ? { id: clientId, name: selectedOption.data('name') } : null;
        const question = $('#user-input').val();
        if (question.trim()) {
            appendMessage('user', clientInfo ? `[${clientInfo.name}様について] ${question}` : question);
            handleGeminiRequest(question, clientInfo); 
            $('#user-input').val('');
        }
    });

    // ID検索機能（利用者登録エリア）
    $('#search-client-by-id').on('click', async function() {
        const id = $('#reg-client-id').val();
        if (!id) return alert("利用者IDを入力してください");
        try {
            const res = await axios.get(`db_action.php?action=search_client&query=${id}`);
            if (res.data.status === "success") {
                const c = res.data.client;
                $('#reg-client-name').val(c.client_name);
                $('#reg-address').val(c.address);
                $('#reg-contact-tel').val(c.contact_tel);
                $('#reg-care-manager').val(c.care_manager);
            } else { alert("見つかりませんでした。"); }
        } catch (e) { alert("エラーが発生しました。"); }
    });

    // 登録・更新処理
    $('#client-register-form').on('submit', async function(e) {
        e.preventDefault();
        const data = {
            id: $('#reg-client-id').val(),
            client_name: $('#reg-client-name').val(),
            address: $('#reg-address').val(),
            contact_tel: $('#reg-contact-tel').val(),
            care_manager: $('#reg-care-manager').val()
        };
        try {
            const check = await axios.get(`db_action.php?action=search_client&query=${data.id}`);
            const action = (check.data.status === "success") ? 'update_client' : 'add_client';
            const res = await axios.post(`db_action.php?action=${action}`, data);
            if(res.data.status === "success") {
                alert(action === 'update_client' ? "更新しました。" : "登録しました。");
                fetchClients();
            }
        } catch (error) { alert("失敗しました。"); }
    });

    // 記録保存
    $('#record-add-form').on('submit', async function(e) {
        e.preventDefault();
        const data = {
            client_id: $('#record-client-select').val(),
            date: $('#record-date').val(),
            time: $('#record-time').val(),
            content: $('#record-content').val(),
            recorded_by: getCurrentUserName()
        };
        try {
            const res = await axios.post('db_action.php?action=add_record', data);
            if (res.data.status === "success") {
                alert("保存完了");
                $('#record-content').val('');
            }
        } catch (error) { alert("失敗しました。"); }
    });

    // 利用者検索・履歴表示
    $('#client-search-form').on('submit', async function(e) {
        e.preventDefault();
        const query = $('#search-query').val();
        const resultsArea = $('#search-results-area');
        resultsArea.html('<p>検索中...</p>');
        try {
            const res = await axios.get(`db_action.php?action=search_client&query=${query}`);
            if (res.data.status === "success") {
                const c = res.data.client;
                const records = res.data.records;
                let html = `<div style="background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #ddd; margin-bottom:20px;"><h3>${c.client_name} 様</h3><p>住所: ${c.address}</p></div>`;
                if (records.length > 0) {
                    let currentDate = "";
                    records.forEach(r => {
                        const dateOnly = r.recorded_at.split(' ')[0];
                        const timeOnly = r.recorded_at.split(' ')[1].substring(0, 5);
                        if (currentDate !== dateOnly) {
                            if (currentDate !== "") html += `</div>`;
                            currentDate = dateOnly;
                            html += `<div style="margin-bottom:15px;"><div style="background:#eee; padding:5px 10px; font-weight:bold; border-radius:4px;">${dateOnly}</div>`;
                        }
                        html += `<div style="padding:8px 10px; border-bottom:1px solid #eee; font-size:0.95em;">${timeOnly} - ${r.content}</div>`;
                    });
                    html += `</div>`;
                } else { html += '<p>記録なし</p>'; }
                resultsArea.html(html);
            } else { resultsArea.html('<p>該当なし</p>'); }
        } catch (error) { resultsArea.html('<p>エラー</p>'); }
    });

    // 住所検索
    $('#search-zipcode').on('click', async function() {
        const zipcode = $('#reg-zipcode').val();
        try {
            const res = await axios.get(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
            if (res.data.results) {
                const r = res.data.results[0];
                $('#reg-address').val(r.address1 + r.address2 + r.address3);
            }
        } catch (e) { alert("検索失敗"); }
    });

    $('#clear-chat-button').on('click', function() {
        if(confirm('チャットをクリアしますか？')) $('#chat-window').empty();
    });
});