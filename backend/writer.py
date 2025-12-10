import csv
import os

class KiCadMerger:
    def __init__(self, original_kicad_path, routes_json):
        self.original_path = original_kicad_path
        self.routes = routes_json.get("routes", [])

    def generate_csv(self, output_csv_path):
        headers = ["Net ID", "Net Name", "Type", "Layer", "Start X", "Start Y", "End X", "End Y", "Width/Size"]
        with open(output_csv_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for route in self.routes:
                if route.get("failed"): continue
                net_id = route.get("net_id")
                net_name = route.get("net")
                for seg in route.get("segments", []):
                    writer.writerow([net_id, net_name, "Segment", seg["layer"], seg["start"][0], seg["start"][1], seg["end"][0], seg["end"][1], seg["width"]])
                for via in route.get("vias", []):
                    writer.writerow([net_id, net_name, "Via", f"{via['from']}/{via['to']}", via["at"][0], via["at"][1], via["at"][0], via["at"][1], via["size"]])
        return output_csv_path

    def generate_kicad_board(self, output_kicad_path):
        new_sexprs = []
        for route in self.routes:
            if route.get("failed"): continue
            net_id = route.get("net_id")
            for seg in route.get("segments", []):
                new_sexprs.append(f'  (segment (start {seg["start"][0]} {seg["start"][1]}) (end {seg["end"][0]} {seg["end"][1]}) (width {seg["width"]}) (layer "{seg["layer"]}") (net {net_id}))')
            for via in route.get("vias", []):
                new_sexprs.append(f'  (via (at {via["at"][0]} {via["at"][1]}) (size {via["size"]}) (drill {via["drill"]}) (layers "{via["from"]}" "{via["to"]}") (net {net_id}))')

        with open(self.original_path, "r", encoding="utf-8") as f:
            original_content = f.read()

        last_paren_index = original_content.rfind(')')
        if last_paren_index == -1: raise ValueError("Invalid KiCad file")

        merged_content = original_content[:last_paren_index] + "\n" + "\n".join(new_sexprs) + "\n" + original_content[last_paren_index:]
        
        with open(output_kicad_path, "w", encoding="utf-8") as f:
            f.write(merged_content)
        return output_kicad_path