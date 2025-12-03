## bug

When findByIds returns fewer tenants than requested, we only create statuses for the found tenants. The original code would have processed all requested tenant IDs.

Expected to return status fr all input tenant IDs.
