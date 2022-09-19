use tokio_tungstenite::tungstenite::handshake::server::{
    Callback, ErrorResponse, Request, Response,
};

pub struct Responder;

impl Callback for Responder {
    fn on_request(self, request: &Request, response: Response) -> Result<Response, ErrorResponse> {
        println!("on_request");
        Err(ErrorResponse::new(Some("ok".to_string())))
    }
}
