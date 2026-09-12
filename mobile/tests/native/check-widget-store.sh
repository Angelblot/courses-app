#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
task_dir=$(mktemp -d /tmp/tablee-widget-check.XXXXXX)
trap 'rm -rf "$task_dir"' EXIT
sed '/^enum TableeStore {/,$d' ios/TableeShared/TableeStore.swift > "$task_dir/Model.swift"
cp tests/native/widget-store.swift "$task_dir/main.swift"
swiftc "$task_dir/Model.swift" "$task_dir/main.swift" -o "$task_dir/check"
"$task_dir/check"
