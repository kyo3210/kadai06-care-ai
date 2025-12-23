<?php
// =======================================================
// 1. エラー報告設定（本番運用時は0にすることをお勧めします）
// =======================================================
ini_set('display_errors', 0); // 画面にPHPエラーを出さない（JSONを壊さないため）
error_reporting(E_ALL);

// =======================================================
// 2. CORS設定（ブラウザからのアクセス許可）
// =======================================================
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// プリフライトリクエスト（OPTIONS）への対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// =======================================================
// 3. メイン処理（POSTリクエストのみ受付）
// =======================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // JavaScript(axios)から送られたデータを受け取る
    $json = file_get_contents("php://input");
    $input = json_decode($json, true);

    $question = $input['question'] ?? '';
    $systemPrompt = $input['systemPrompt'] ?? 'あなたは介護支援AIです。';

    // ---------------------------------------------------
    // 🚨 設定：成功した最新のキーとURL
    // ---------------------------------------------------
    $apiKey = trim(""); 

    // あなたの環境で成功した gemini-2.5-flash エンドポイント
    $baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    $apiUrl = $baseUrl . "?key=" . $apiKey;

    // Google APIに送るデータ構造
    $data = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $systemPrompt . "\n\n" . $question]
                ]
            ]
        ]
    ];

    // ---------------------------------------------------
    // 4. cURL通信の実行
    // ---------------------------------------------------
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    // Windows環境/XAMPPでのSSLエラー対策
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // ---------------------------------------------------
    // 5. 結果の判定とJavaScriptへの返却
    // ---------------------------------------------------
    $result = json_decode($response, true);

    // Googleから正常な回答(200)が返ってきたかチェック
    if ($httpCode === 200 && isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        // AIの回答テキストだけを抽出してJSONで返す
        echo json_encode([
            "answer" => $result['candidates'][0]['content']['parts'][0]['text']
        ]);
    } else {
        // 失敗した場合はエラー情報を返す
        echo json_encode([
            "error" => "Gemini API Error (Status: $httpCode)",
            "details" => $result['error']['message'] ?? '不明なエラーが発生しました。'
        ]);
    }

} else {
    // POST以外のアクセス（直接URLを叩いた場合など）
    echo json_encode(["error" => "Invalid request method."]);
}
?>