//! JSON-RPC 2.0 response types.

use crate::{request::JsonRpcId, error::RpcErrorObject};
use serde::{Deserialize, Serialize};

/// A single JSON-RPC 2.0 response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result:  Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error:   Option<RpcErrorObject>,
    pub id:      Option<JsonRpcId>,
}

impl JsonRpcResponse {
    pub fn success(id: Option<JsonRpcId>, result: serde_json::Value) -> Self {
        Self { jsonrpc: "2.0".into(), result: Some(result), error: None, id }
    }

    pub fn error(id: Option<JsonRpcId>, err: RpcErrorObject) -> Self {
        Self { jsonrpc: "2.0".into(), result: None, error: Some(err), id }
    }
}

/// A pub/sub notification.
#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method:  String,
    pub params:  NotificationParams,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationParams {
    pub subscription: String,
    pub result:       serde_json::Value,
}

impl JsonRpcNotification {
    pub fn new(method: &str, subscription: &str, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            method:  method.to_string(),
            params:  NotificationParams {
                subscription: subscription.to_string(),
                result,
            },
        }
    }
}