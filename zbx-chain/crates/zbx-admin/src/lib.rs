//! zbx-admin — Node administration for Zebvix Chain.
//!
//! Provides:
//! - Admin JSON-RPC server (`admin_*` namespace)
//! - CLI sub-commands for node operators
//! - Live configuration reload
//! - Validator / mempool / storage management
//! - Metrics and diagnostic endpoints

pub mod error;
pub mod auth;
pub mod config;
pub mod rpc;
pub mod cli;
pub mod validator_mgmt;
pub mod mempool_mgmt;
pub mod db_inspect;
pub mod metrics;
pub mod backup;

pub use error::AdminError;

/// Admin API version tag.
pub const ADMIN_API_VERSION: &str = "zbx_admin/1";