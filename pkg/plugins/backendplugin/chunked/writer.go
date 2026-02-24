package chunked

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func IsRequestingChunkedResponse(accept string) bool {
	return accept == "text/event-stream"
}

var (
	_ RawChunkReceiver          = (*rawChunkWriter)(nil)
	_ backend.ChunkedDataWriter = (*rawChunkWriter)(nil)
)

type rawChunkWriter struct {
	w http.ResponseWriter
}

func NewHTTPWriter(w http.ResponseWriter) *rawChunkWriter {
	return &rawChunkWriter{w}
}

// ReceivedChunk implements [backendplugin.RawChunkReceiver].
func (r *rawChunkWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	// Write directly to the response -- avoiding any additional buffering
	_, _ = r.w.Write([]byte(`data: {"refId":"`))
	_, _ = r.w.Write([]byte(chunk.RefId))
	_, _ = r.w.Write([]byte(`"`))

	if chunk.FrameId != "" {
		r.writeField("frameId", chunk.FrameId)
	}

	if chunk.Frame != nil {
		// Ensure the frame is in JSON, convert it from arrow if necessary
		if chunk.Format != pluginv2.DataFrameFormat_JSON {
			tmp, err := data.UnmarshalArrowFrame(chunk.Frame)
			if err != nil {
				return fmt.Errorf("failed to unmarshal frame: %w", err)
			}
			chunk.Frame, err = tmp.MarshalJSON()
			if err != nil {
				return fmt.Errorf("failed to marshal frame to JSON: %w", err)
			}
		}

		_, _ = r.w.Write([]byte(`,"frame":`))
		_, _ = r.w.Write(chunk.Frame)
		_, _ = r.w.Write([]byte(`"`))
	}

	if chunk.Error != "" {
		r.writeField("error", chunk.Error)

		if chunk.ErrorSource != "" {
			r.writeField("errorSource", chunk.ErrorSource)
		}
	}

	if _, err := r.w.Write([]byte(`}\n\n`)); err != nil {
		return err
	}
	flusher, ok := r.w.(http.Flusher)
	if ok {
		flusher.Flush()
	}
	return nil
}

func (r *rawChunkWriter) writeField(f string, v string) {
	_, _ = r.w.Write([]byte(`,"` + f + `":"`))
	_, _ = r.w.Write([]byte(v))
	_, _ = r.w.Write([]byte(`"`))
}

// WriteError implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	return fmt.Errorf("unexpected callback (WriteError)")
}

// WriteFrame implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteFrame(ctx context.Context, refID string, frameID string, f *data.Frame) error {
	return fmt.Errorf("unexpected callback (WriteFrame)")
}
