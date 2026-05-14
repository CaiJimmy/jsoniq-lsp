#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WRAPPER_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

RUMBLE_DIR="$WRAPPER_DIR/rumble"
RUMBLE_LSP_ASSEMBLY_DESCRIPTOR="$WRAPPER_DIR/rumble-lsp-assembly.xml"
RUMBLE_LSP_ASSEMBLY_POM="$WRAPPER_DIR/rumble-lsp-pom.xml"

WRAPPER_TARGET_DIR="$WRAPPER_DIR/target"
WRAPPER_GENERATED_RESOURCES_DIR="$WRAPPER_DIR/generated-resources"
WRAPPER_CLASSES_DIR="$WRAPPER_TARGET_DIR/classes"

WRAPPER_METADATA_FILE="$WRAPPER_GENERATED_RESOURCES_DIR/rumble-build.properties"
WRAPPER_COMPILED_METADATA_FILE="$WRAPPER_CLASSES_DIR/rumble-build.properties"
WRAPPER_RUMBLE_JAR_LINK="$WRAPPER_GENERATED_RESOURCES_DIR/rumbledb-current-jar-with-dependencies.jar"
WRAPPER_BUILD_STAMP="$WRAPPER_GENERATED_RESOURCES_DIR/rumble-build.stamp"

RUMBLE_REPO_URL="https://github.com/RumbleDB/rumble.git"
RUMBLE_REF="jimmy/master"
RUMBLE_TARGET_DIR="$RUMBLE_DIR/target"

ensure_rumble_checkout() {
    if [ ! -d "$RUMBLE_DIR" ]; then
        echo "Cloning Rumble repository from $RUMBLE_REPO_URL (ref: $RUMBLE_REF)..." >&2
        git clone --depth 1 --branch "$RUMBLE_REF" "$RUMBLE_REPO_URL" "$RUMBLE_DIR"
        return
    fi

    if [ ! -e "$RUMBLE_DIR/.git" ]; then
        echo "Expected a git checkout at $RUMBLE_DIR" >&2
        exit 1
    fi
}

detect_rumble_ref() {
    current_ref=$(git -C "$RUMBLE_DIR" branch --show-current 2>/dev/null || true)
    if [ -n "$current_ref" ]; then
        printf '%s\n' "$current_ref"
        return
    fi

    printf 'detached\n'
}

write_metadata_file() {
    metadata_file=$1
    rumble_version=""
    if [ -n "$RUMBLE_JAR" ]; then
        rumble_version=$(extract_rumble_version_from_jar "$RUMBLE_JAR")
    fi
    mkdir -p "$(dirname "$metadata_file")"
    cat >"$metadata_file" <<EOF
rumble.repoUrl=$RUMBLE_REPO_URL
rumble.requestedRef=$RUMBLE_REF
rumble.currentRef=$RUMBLE_CURRENT_REF
rumble.version=$rumble_version
rumble.commit=$RUMBLE_COMMIT
rumble.commitShort=$RUMBLE_COMMIT_SHORT
rumble.jar=$RUMBLE_JAR
EOF
}

build_signature() {
    assembly_descriptor_sha=$(shasum -a 256 "$RUMBLE_LSP_ASSEMBLY_DESCRIPTOR" | awk '{print $1}')
    assembly_pom_sha=$(shasum -a 256 "$RUMBLE_LSP_ASSEMBLY_POM" | awk '{print $1}')
    cat <<EOF
commit=$RUMBLE_COMMIT
rumbleVersion=$RUMBLE_VERSION
assemblyDescriptor=$assembly_descriptor_sha
assemblyPom=$assembly_pom_sha
jar=$RUMBLE_JAR
EOF
}

stamp_matches_current_build() {
    if [ ! -f "$WRAPPER_BUILD_STAMP" ]; then
        return 1
    fi

    [ "$(cat "$WRAPPER_BUILD_STAMP")" = "$CURRENT_BUILD_SIGNATURE" ]
}

resolve_rumble_jar() {
    jar_path=$(ls -1t "$RUMBLE_TARGET_DIR"/rumbledb-*-lsp.jar 2>/dev/null | head -n 1 || true)
    if [ -z "$jar_path" ]; then
        return 1
    fi

    printf '%s\n' "$jar_path"
}

extract_rumble_version_from_jar() {
    jar_file=$(basename "$1")
    version=${jar_file#rumbledb-}
    version=${version%-lsp.jar}
    version=${version%-jar-with-dependencies.jar}
    printf '%s\n' "$version"
}

detect_rumble_version_from_pom() {
    awk '
        match($0, /<version>[^<]+<\/version>/) {
            value = $0
            sub(/^.*<version>/, "", value)
            sub(/<\/version>.*$/, "", value)
            print value
            exit
        }
    ' "$RUMBLE_DIR/pom.xml"
}

update_rumble_jar_link() {
    mkdir -p "$WRAPPER_GENERATED_RESOURCES_DIR"
    ln -sf "$RUMBLE_JAR" "$WRAPPER_RUMBLE_JAR_LINK"
    echo "Linked Rumble jar to $WRAPPER_RUMBLE_JAR_LINK" >&2
}

ensure_rumble_checkout

RUMBLE_COMMIT=$(git -C "$RUMBLE_DIR" rev-parse HEAD)
RUMBLE_COMMIT_SHORT=$(git -C "$RUMBLE_DIR" rev-parse --short HEAD)
RUMBLE_CURRENT_REF=$(detect_rumble_ref)
RUMBLE_VERSION=$(detect_rumble_version_from_pom)
RUMBLE_JAR=$(resolve_rumble_jar 2>/dev/null || true)
CURRENT_BUILD_SIGNATURE=$(build_signature)

write_metadata_file "$WRAPPER_METADATA_FILE"
if [ -d "$WRAPPER_CLASSES_DIR" ]; then
    write_metadata_file "$WRAPPER_COMPILED_METADATA_FILE"
fi

if [ -z "$RUMBLE_JAR" ] || ! stamp_matches_current_build; then
    echo "Building Rumble LSP assembly from source..." >&2
    (cd "$RUMBLE_DIR" && mvn -q -DskipTests clean compile)
    (
        cd "$WRAPPER_DIR"
        mvn -q -f "$RUMBLE_LSP_ASSEMBLY_POM" -Drumble.version="$RUMBLE_VERSION" assembly:single
    )
    RUMBLE_JAR=$(resolve_rumble_jar)
    CURRENT_BUILD_SIGNATURE=$(build_signature)
fi

update_rumble_jar_link
write_metadata_file "$WRAPPER_METADATA_FILE"
if [ -d "$WRAPPER_CLASSES_DIR" ]; then
    write_metadata_file "$WRAPPER_COMPILED_METADATA_FILE"
fi
printf '%s' "$CURRENT_BUILD_SIGNATURE" >"$WRAPPER_BUILD_STAMP"

echo "Prepared Rumble $(extract_rumble_version_from_jar "$RUMBLE_JAR") at commit $RUMBLE_COMMIT_SHORT ($RUMBLE_CURRENT_REF)." >&2
