package org.jsoniq.lsp.rumble.handlers;

import org.jsoniq.lsp.rumble.messages.Request;
import org.jsoniq.lsp.rumble.messages.ResponseBody;

public class Handshake implements RequestHandler {
    private static final String RUMBLE_VERSION = "2.0.0";

    private record Response(String rumbleVersion) implements ResponseBody {
    }

    static String getRumbleVersion() {
        return RUMBLE_VERSION;
    }

    @Override
    public String getRequestType() {
        return "handshake";
    }

    @Override
    public ResponseBody handle(Request request) {
        return new Response(getRumbleVersion());
    }

    @Override
    public ResponseBody createEmptyResponse() {
        return new Response(getRumbleVersion());
    }
}
