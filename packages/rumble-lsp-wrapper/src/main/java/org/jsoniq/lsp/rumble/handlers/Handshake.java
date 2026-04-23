package org.jsoniq.lsp.rumble.handlers;

import org.jsoniq.lsp.rumble.messages.Request;
import org.jsoniq.lsp.rumble.messages.ResponseBody;
import org.rumbledb.api.Rumble;

public class Handshake implements RequestHandler {

    private record Response(String rumbleVersion) implements ResponseBody {
    }

    static String getRumbleVersion() {
        return Rumble.class.getPackage().getImplementationVersion() == null ? "unknown"
                : Rumble.class.getPackage().getImplementationVersion();
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
