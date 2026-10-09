//! Cetak mentah (ESC/POS) ke printer struk.
//! - USB / printer Windows: lewat spooler Windows dengan tipe data RAW (crate `printers`).
//! - LAN: kirim langsung ke port 9100 printer.
//! Tidak bergantung pada Tauri supaya bisa diuji sendiri.

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

pub const MAX_JOB: usize = 256 * 1024;

pub fn list_printers() -> Vec<String> {
    let mut names: Vec<String> = printers::get_printers().into_iter().map(|p| p.name).collect();
    names.sort();
    names.dedup();
    names
}

pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
    check_size(data)?;
    let p = printers::get_printer_by_name(printer)
        .ok_or_else(|| format!("Printer \"{printer}\" tidak ditemukan. Pastikan printer menyala dan terpasang di Windows."))?;
    let opts = printers::common::base::job::PrinterJobOptions {
        name: Some("Fortuner POS"),
        raw_properties: &[("document-format", "RAW")],
        converter: printers::common::converters::Converter::None,
    };
    p.print(data, opts).map(|_| ()).map_err(|e| format!("Gagal mengirim ke printer \"{printer}\": {e:?}"))
}

pub fn print_tcp(host: &str, port: u16, data: &[u8], timeout: Duration) -> Result<(), String> {
    check_size(data)?;
    let host = host.trim();
    if host.is_empty() {
        return Err("Alamat IP printer belum diisi.".into());
    }
    let addr = (host, port)
        .to_socket_addrs()
        .map_err(|e| format!("Alamat {host}:{port} tidak valid: {e}"))?
        .next()
        .ok_or_else(|| format!("Alamat {host}:{port} tidak ditemukan."))?;
    let mut s = TcpStream::connect_timeout(&addr, timeout)
        .map_err(|e| format!("Tidak bisa terhubung ke printer {host}:{port} ({e}). Cek printer menyala dan IP-nya benar."))?;
    s.set_write_timeout(Some(timeout)).ok();
    s.write_all(data).map_err(|e| format!("Gagal mengirim ke printer {host}:{port}: {e}"))?;
    s.flush().map_err(|e| format!("Gagal mengirim ke printer {host}:{port}: {e}"))?;
    Ok(())
}

fn check_size(data: &[u8]) -> Result<(), String> {
    if data.is_empty() {
        return Err("Tidak ada data untuk dicetak.".into());
    }
    if data.len() > MAX_JOB {
        return Err("Data cetak terlalu besar.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpListener;

    #[test]
    fn tcp_sends_all_bytes() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let h = std::thread::spawn(move || {
            let (mut c, _) = l.accept().unwrap();
            let mut buf = Vec::new();
            c.read_to_end(&mut buf).unwrap();
            buf
        });
        let data: Vec<u8> = (0..5000u32).map(|i| (i % 251) as u8).collect();
        print_tcp("127.0.0.1", port, &data, Duration::from_secs(2)).unwrap();
        assert_eq!(h.join().unwrap(), data);
    }

    #[test]
    fn tcp_refused_gives_message() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        drop(l);
        let e = print_tcp("127.0.0.1", port, &[1, 2, 3], Duration::from_millis(500)).unwrap_err();
        assert!(e.contains("Tidak bisa terhubung"), "{e}");
    }

    #[test]
    fn tcp_timeout_on_unroutable() {
        let t = std::time::Instant::now();
        let e = print_tcp("10.255.255.1", 9100, &[1], Duration::from_millis(600)).unwrap_err();
        assert!(t.elapsed() < Duration::from_secs(5), "{e}");
    }

    #[test]
    fn rejects_empty_and_unknown_printer() {
        assert!(print_tcp("", 9100, &[1], Duration::from_millis(100)).is_err());
        assert!(print_raw("Printer-Yang-Tidak-Ada", &[1]).unwrap_err().contains("tidak ditemukan"));
        assert!(print_raw("x", &[]).is_err());
    }
}
