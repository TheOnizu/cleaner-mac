use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

/// Shared cancellation flag — set to true to request scan abort.
pub struct ScanCancelFlag(pub Arc<AtomicBool>);

impl ScanCancelFlag {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }

    pub fn reset(&self) {
        self.0.store(false, Ordering::Relaxed);
    }

    pub fn flag(&self) -> Arc<AtomicBool> {
        self.0.clone()
    }
}
