<?php
// =======================================================
// 1. 基本設定とCORS（ブラウザからの通信許可）
// =======================================================
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// プリフライトリクエスト（OPTIONS）への対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// =======================================================
// 2. データベース接続設定 (XAMPPデフォルト)
// =======================================================
// さくらサーバへ移行する際は、ここをサーバ情報に書き換えます
$dsn = 'mysql:dbname=care_db;host=localhost;charset=utf8';
$user = 'root'; 
$password = ''; 

try {
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $action = $_GET['action'] ?? '';

    // =======================================================
    // 3. アクション別の処理
    // =======================================================

    // --- A. 利用者一覧の取得（セレクトボックス用） ---
    if ($action === 'fetch_clients') {
        $stmt = $pdo->query("SELECT id, client_name FROM clients ORDER BY created_at DESC");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // --- B. 利用者の新規登録 ---
    if ($action === 'add_client') {
        $input = json_decode(file_get_contents("php://input"), true);
        
        $sql = "INSERT INTO clients (id, client_name, address, contact_tel, care_manager) 
                VALUES (:id, :name, :address, :tel, :cm)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'      => $input['id'],
            ':name'    => $input['client_name'],
            ':address' => $input['address'],
            ':tel'     => $input['contact_tel'],
            ':cm'      => $input['care_manager']
        ]);
        
        echo json_encode(["status" => "success"]);
        exit;
    }

    // --- C. ケア記録の追加 ---
    if ($action === 'add_record') {
        $input = json_decode(file_get_contents("php://input"), true);
        
        // HTMLからの日付と時刻を MySQL形式(YYYY-MM-DD HH:MM:SS)に結合
        $recorded_at = $input['date'] . ' ' . $input['time'] . ':00';

        $sql = "INSERT INTO care_records (client_id, content, recorded_by, recorded_at) 
                VALUES (:client_id, :content, :recorded_by, :recorded_at)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':client_id'   => $input['client_id'],
            ':content'     => $input['content'],
            ':recorded_by' => $input['recorded_by'],
            ':recorded_at' => $recorded_at
        ]);
        
        echo json_encode(["status" => "success"]);
        exit;
    }

    // --- D. 【重要】AIへ渡すための過去記録取得 ---
if ($action === 'get_client_history') {
    $client_id = $_GET['client_id'] ?? '';
    // 件数指定を受け取る（指定がなければ30件）
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 30;

    $sql = "SELECT content, recorded_at 
            FROM care_records 
            WHERE client_id = ? 
            ORDER BY recorded_at DESC 
            LIMIT ?";
            
    $stmt = $pdo->prepare($sql);
    // LIMIT句には bindParam または bindValue で型を指定して渡す必要があります
    $stmt->bindValue(1, $client_id, PDO::PARAM_STR);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $records = $stmt->fetchAll();
    
    echo json_encode($records);
    exit;
}

    // --- E. 利用者の詳細検索（画面表示用） ---
    if ($action === 'search_client') {
        $query = $_GET['query'] ?? '';
        
        // IDまたは氏名で部分一致検索
        $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ? OR client_name LIKE ?");
        $stmt->execute([$query, "%$query%"]);
        $client = $stmt->fetch();

        if ($client) {
            // その利用者の全記録も取得
            $stmtRecords = $pdo->prepare("SELECT * FROM care_records WHERE client_id = ? ORDER BY recorded_at DESC");
            $stmtRecords->execute([$client['id']]);
            $records = $stmtRecords->fetchAll();

            echo json_encode([
                "status" => "success",
                "client" => $client,
                "records" => $records
            ]);
        } else {
            echo json_encode(["status" => "not_found"]);
        }
        exit;
    }

} catch (PDOException $e) {
    // データベースエラー時のレスポンス
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "DB Error: " . $e->getMessage()
    ]);
}

// --- F. 利用者情報の更新 (編集用) ---
if ($action === 'update_client') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    $sql = "UPDATE clients SET 
            client_name = :name, 
            address = :address, 
            contact_tel = :tel, 
            care_manager = :cm 
            WHERE id = :id";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':id'      => $input['id'],
        ':name'    => $input['client_name'],
        ':address' => $input['address'],
        ':tel'     => $input['contact_tel'],
        ':cm'      => $input['care_manager']
    ]);
    
    echo json_encode(["status" => "success"]);
    exit;
}
?>