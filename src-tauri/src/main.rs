// Sembunyikan jendela konsol di Windows saat versi rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    fortuner_pos_lib::run()
}
