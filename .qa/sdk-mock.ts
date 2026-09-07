// Test-only sentinel. Integration tests must inject the in-memory Store.
export const db=new Proxy({}, {get(){throw Error('Unexpected real SDK access in local test');}});

