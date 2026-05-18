//! Method router: maps method names to async handler functions.

use crate::{
    error::{RpcError, RpcErrorObject},
    request::JsonRpcRequest,
};
use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc};

/// Alias for an async RPC handler's return type.
pub type HandlerFuture =
    Pin<Box<dyn Future<Output = Result<serde_json::Value, RpcErrorObject>> + Send>>;

pub type RpcHandler = Arc<dyn Fn(JsonRpcRequest) -> HandlerFuture + Send + Sync>;

/// Method router: registry of RPC method handlers.
#[derive(Clone)]
pub struct RpcRouter {
    methods: HashMap<String, RpcHandler>,
}

impl RpcRouter {
    pub fn new() -> Self {
        Self { methods: HashMap::new() }
    }

    /// Register a method handler.
    pub fn method<F, Fut>(mut self, name: &str, handler: F) -> Self
    where
        F: Fn(JsonRpcRequest) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<serde_json::Value, RpcErrorObject>> + Send + 'static,
    {
        let handler: RpcHandler = Arc::new(move |req| Box::pin(handler(req)));
        self.methods.insert(name.to_string(), handler);
        self
    }

    /// Dispatch a single request.
    pub async fn dispatch(
        &self,
        req: JsonRpcRequest,
    ) -> Result<serde_json::Value, RpcErrorObject> {
        match self.methods.get(&req.method) {
            Some(handler) => handler(req).await,
            None => Err(RpcErrorObject::method_not_found(&req.method)),
        }
    }

    /// List all registered methods.
    pub fn method_names(&self) -> Vec<&str> {
        self.methods.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for RpcRouter {
    fn default() -> Self {
        Self::new()
    }
}