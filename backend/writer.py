import csv
import os
import io

class KiCadMerger:
    def __init__(self, original_kicad_path, routes_json):
        self.original_path = original_kicad_path
        self.routes = routes_json.get("routes", [])

    def generate_csv_bytes(self) -> bytes:
        """
        Generate the routes CSV as UTF-8 bytes (in-memory).
        This avoids filesystem overhead when the caller ultimately zips/streams the result.
        """
        headers = ["Net ID", "Net Name", "Type", "Layer", "Start X", "Start Y", "End X", "End Y", "Width/Size"]
        sio = io.StringIO()
        writer = csv.writer(sio)
        writer.writerow(headers)
        for route in self.routes:
            if route.get("failed"):
                continue
            net_id = route.get("net_id")
            net_name = route.get("net")
            for seg in route.get("segments", []):
                writer.writerow([
                    net_id, net_name, "Segment", seg["layer"],
                    seg["start"][0], seg["start"][1],
                    seg["end"][0], seg["end"][1],
                    seg["width"],
                ])
            for via in route.get("vias", []):
                writer.writerow([
                    net_id, net_name, "Via", f'{via["from"]}/{via["to"]}',
                    via["at"][0], via["at"][1],
                    via["at"][0], via["at"][1],
                    via["size"],
                ])
        return sio.getvalue().encode("utf-8")

    def generate_csv(self, output_csv_path):
        csv_bytes = self.generate_csv_bytes()
        with open(output_csv_path, "wb") as f:
            f.write(csv_bytes)
        return output_csv_path

    def generate_kicad_board_text(self) -> str:
        """
        Generate the merged KiCad board file as a string (in-memory).
        """
        new_sexprs = []
        for route in self.routes:
            if route.get("failed"):
                continue
            net_id = route.get("net_id")
            for seg in route.get("segments", []):
                new_sexprs.append(
                    f'  (segment (start {seg["start"][0]} {seg["start"][1]}) '
                    f'(end {seg["end"][0]} {seg["end"][1]}) (width {seg["width"]}) '
                    f'(layer "{seg["layer"]}") (net {net_id}))'
                )
            for via in route.get("vias", []):
                new_sexprs.append(
                    f'  (via (at {via["at"][0]} {via["at"][1]}) (size {via["size"]}) '
                    f'(drill {via["drill"]}) (layers "{via["from"]}" "{via["to"]}") (net {net_id}))'
                )

        with open(self.original_path, "r", encoding="utf-8") as f:
            original_content = f.read()

        last_paren_index = original_content.rfind(")")
        if last_paren_index == -1:
            raise ValueError("Invalid KiCad file")

        return (
            original_content[:last_paren_index]
            + "\n"
            + "\n".join(new_sexprs)
            + "\n"
            + original_content[last_paren_index:]
        )

    def generate_kicad_board(self, output_kicad_path):
        merged_content = self.generate_kicad_board_text()
        with open(output_kicad_path, "w", encoding="utf-8") as f:
            f.write(merged_content)
        return output_kicad_path