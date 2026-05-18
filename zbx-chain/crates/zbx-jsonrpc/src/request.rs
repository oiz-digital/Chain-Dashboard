//! JSON-RPC 2.0 request types.

use serde::{Deserialize, Serialize};

/// JSON-RPC request ID (null, number, or string).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcId {
    Null,
    Number(i64),
    String(String),
}

/// A single JSON-RPC 2.0 request or notification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method:  String,
    #[serde(default)]
    pub params:  serde_json::Value,
    /// Absent for notifications.
    pub id:      Option<JsonRpcId>,
}

impl JsonRpcRequest {
    pub fn is_notification(&self) -> bool {
        self.id.is_none()
    }

    pub fn validate(&self) -> bool {
        self.jsonrpc == "2.0" && !self.method.is_empty()
    }
}

/// Either a single request or a batch.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcCall {
    Single(JsonRpcRequest),
    Batch(Vec<JsonRpcRequest>),
}