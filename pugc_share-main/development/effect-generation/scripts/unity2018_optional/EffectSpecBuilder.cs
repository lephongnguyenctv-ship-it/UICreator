// =====================================================================================================
//  Effect Spec Builder – builds an FF-compatible particle prefab from a JSON spec (Unity 2018.4, Built-in).
//
//  Batch (through the exporter):
//      Unity -batchmode -quit -projectPath <p> -executeMethod UniverseFX.FF.UniverseFabExporter.ExportBatch -fabSpec <spec.json>
//  Build only (no export):
//      Unity -batchmode -quit -projectPath <p> -executeMethod UniverseFX.FF.EffectSpecBuilder.BuildBatch -fabSpec <spec.json>
//
//  Output: Assets/Effects/<name>/<name>.prefab (+ Textures/, Materials/). Validated with UniverseFFValidator.
//  Only GameObject / Transform / ParticleSystem / ParticleSystemRenderer; "Particles/Standard Unlit" materials;
//  at most 30 particles per system (see skill docs).
//
//  Written for C# 7.3 / Unity 2018.4 API.
// =====================================================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace UniverseFX.FF
{
    [Serializable]
    public class FxSpec
    {
        public string name = "effect";
        public FxSystem[] systems = new FxSystem[0];
    }

    [Serializable]
    public class FxSystem
    {
        public string name = "System";
        // procedural texture: glow | sparkle | cloud | disc | ring | trail
        public string texture = "glow";
        public float[] color = { 1f, 1f, 1f, 1f };      // RGBA 0..1, start color
        public float[] colorEnd = null;                 // optional RGBA, color over lifetime
        public int maxParticles = 20;                   // capped at 30
        public float rate = 5f;                         // particles per second
        public float lifetime = 2f;
        public float speed = 0f;                        // start speed
        public float size = 0.3f;                       // start size
        public float sizeEnd = 0.1f;                    // size at end of lifetime (ratio uses sizeEnd/size)
        public string shape = "circle";                 // none | circle | sphere | cone | box
        public float radius = 1f;
        public float orbitSpeed = 0f;                   // Velocity over Lifetime → Orbital Y (radians/sec)
        public float spin = 0f;                         // Rotation over Lifetime Z (radians/sec)
        public float[] position = { 0f, 0f, 0f };       // local position
        public float[] tilt = { 0f, 0f, 0f };           // local euler rotation (degrees)
        public bool additive = true;
        public bool trail = false;                      // Trails module (uses texture "trail" as trail material)
    }

    public static class EffectSpecBuilder
    {
        const string ShaderName = "Particles/Standard Unlit";
        const int MaxParticles = 30;
        const int TexSize = 128;

        public static FxSpec Load(string specPath)
        {
            if (!File.Exists(specPath)) throw new FileNotFoundException("Spec not found: " + specPath);
            FxSpec s = JsonUtility.FromJson<FxSpec>(File.ReadAllText(specPath));
            if (s == null || string.IsNullOrEmpty(s.name) || s.systems == null || s.systems.Length == 0)
                throw new InvalidOperationException("Spec needs a 'name' and at least one entry in 'systems': " + specPath);
            return s;
        }

        public static string SafeName(string name)
        {
            var sb = new System.Text.StringBuilder();
            foreach (char c in name.ToLowerInvariant())
                sb.Append(char.IsLetterOrDigit(c) ? c : '_');
            return sb.ToString().Trim('_');
        }

        /// <summary>Batch entry: builds the effect from -fabSpec and validates it, without exporting.</summary>
        public static void BuildBatch()
        {
            string spec = null;
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-fabSpec") spec = args[i + 1];
            if (spec == null) throw new InvalidOperationException("Missing -fabSpec <path>");
            string path = Build(spec);
            EditorApplication.Exit(path != null ? 0 : 1);
        }

        /// <summary>Builds the prefab from the spec and returns its path. Throws on validation errors.</summary>
        public static string Build(string specPath)
        {
            FxSpec spec = Load(specPath);
            string name = SafeName(spec.name);
            string root = "Assets/Effects/" + name;
            string texDir = root + "/Textures";
            string matDir = root + "/Materials";
            string prefabPath = root + "/" + name + ".prefab";

            if (AssetDatabase.IsValidFolder(root)) AssetDatabase.DeleteAsset(root);
            Directory.CreateDirectory(texDir);
            Directory.CreateDirectory(matDir);
            AssetDatabase.Refresh();

            var go = new GameObject(name);
            try
            {
                for (int i = 0; i < spec.systems.Length; i++)
                {
                    FxSystem s = spec.systems[i];
                    string sysName = string.IsNullOrEmpty(s.name) ? "System" + i : s.name;
                    Texture2D tex = BakeTexture(s.texture, texDir, name + "_" + SafeName(sysName));
                    Material mat = MakeMaterial(matDir, name + "_" + SafeName(sysName), tex, s.additive);
                    Material trailMat = null;
                    if (s.trail) trailMat = MakeMaterial(matDir, name + "_" + SafeName(sysName) + "_trail", BakeTexture("trail", texDir, name + "_" + SafeName(sysName) + "_trail"), true);
                    AddSystem(go.transform, sysName, s, mat, trailMat);
                }

                PrefabUtility.SaveAsPrefabAsset(go, prefabPath);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(go);
            }
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            GameObject saved = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            if (!UniverseFFValidator.Validate(saved))
                throw new InvalidOperationException("Effect '" + name + "' failed FF validation (see Console).");
            Debug.Log("[Effect] built " + prefabPath);
            return prefabPath;
        }

        // ================================================================== particle system

        static void AddSystem(Transform parent, string sysName, FxSystem s, Material mat, Material trailMat)
        {
            var child = new GameObject(sysName);
            child.transform.SetParent(parent, false);
            child.transform.localPosition = V3(s.position);
            child.transform.localEulerAngles = V3(s.tilt);

            ParticleSystem ps = child.AddComponent<ParticleSystem>();   // also adds ParticleSystemRenderer
            ParticleSystemRenderer rend = child.GetComponent<ParticleSystemRenderer>();

            Color c1 = C(s.color);
            ParticleSystem.MainModule main = ps.main;
            main.loop = true;
            main.playOnAwake = true;
            main.duration = 1f;
            main.startLifetime = Mathf.Max(0.05f, s.lifetime);
            main.startSpeed = s.speed;
            main.startSize = s.size;
            main.startRotation = 0f;
            main.startColor = new ParticleSystem.MinMaxGradient(c1);
            main.gravityModifier = 0f;
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            main.maxParticles = Mathf.Clamp(s.maxParticles, 1, MaxParticles);

            ParticleSystem.EmissionModule em = ps.emission;
            em.enabled = true;
            em.rateOverTime = s.rate;

            ParticleSystem.ShapeModule sh = ps.shape;
            string shape = (s.shape ?? "none").ToLowerInvariant();
            sh.enabled = shape != "none";
            sh.radius = s.radius;
            switch (shape)
            {
                case "sphere": sh.shapeType = ParticleSystemShapeType.Sphere; break;
                case "cone": sh.shapeType = ParticleSystemShapeType.Cone; break;
                case "box": sh.shapeType = ParticleSystemShapeType.Box; break;
                default: sh.shapeType = ParticleSystemShapeType.Circle; break;
            }

            if (Mathf.Abs(s.size) > 0.0001f)
            {
                ParticleSystem.SizeOverLifetimeModule sol = ps.sizeOverLifetime;
                sol.enabled = true;
                float ratio = Mathf.Max(0f, s.sizeEnd / s.size);
                sol.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0f, 1f, 1f, ratio));
            }

            if (s.colorEnd != null && s.colorEnd.Length >= 3)
            {
                Color c2 = C(s.colorEnd);
                var g = new Gradient();
                g.SetKeys(
                    new[] { new GradientColorKey(c1, 0f), new GradientColorKey(c2, 1f) },
                    new[] { new GradientAlphaKey(c1.a, 0f), new GradientAlphaKey(c2.a, 1f) });
                ParticleSystem.ColorOverLifetimeModule col = ps.colorOverLifetime;
                col.enabled = true;
                col.color = new ParticleSystem.MinMaxGradient(g);
            }

            if (Mathf.Abs(s.orbitSpeed) > 0.0001f)
            {
                ParticleSystem.VelocityOverLifetimeModule vel = ps.velocityOverLifetime;
                vel.enabled = true;
                vel.space = ParticleSystemSimulationSpace.Local;
                vel.orbitalY = new ParticleSystem.MinMaxCurve(s.orbitSpeed);
            }

            if (Mathf.Abs(s.spin) > 0.0001f)
            {
                ParticleSystem.RotationOverLifetimeModule rot = ps.rotationOverLifetime;
                rot.enabled = true;
                rot.z = new ParticleSystem.MinMaxCurve(s.spin);
            }

            ParticleSystem.TrailModule tr = ps.trails;
            tr.enabled = s.trail;
            if (s.trail)
            {
                tr.ratio = 1f;
                tr.lifetime = 0.5f;
                tr.minVertexDistance = 0.1f;
                tr.widthOverTrail = 0.5f;
                rend.trailMaterial = trailMat;
            }

            rend.renderMode = ParticleSystemRenderMode.Billboard;
            rend.alignment = ParticleSystemRenderSpace.View;
            rend.sharedMaterial = mat;
            rend.shadowCastingMode = ShadowCastingMode.Off;
            rend.receiveShadows = false;
            rend.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
            rend.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
        }

        // ================================================================== materials

        static Material MakeMaterial(string dir, string name, Texture2D tex, bool additive)
        {
            Shader shader = Shader.Find(ShaderName);
            if (shader == null) throw new InvalidOperationException("Shader '" + ShaderName + "' not found.");

            string path = dir + "/M_" + name + ".mat";
            AssetDatabase.DeleteAsset(path);
            var m = new Material(shader) { name = "M_" + name };

            m.shaderKeywords = new string[0];
            m.SetOverrideTag("RenderType", "Transparent");
            m.SetFloat("_ZWrite", 0f);
            m.SetFloat("_Cull", 0f);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", additive ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_Mode", additive ? 4f : 2f);        // Fade = 2, Additive = 4 (StandardParticlesShaderGUI)
            m.SetFloat("_ColorMode", 0f);
            m.SetFloat("_BlendOp", (float)BlendOp.Add);
            m.EnableKeyword("_ALPHABLEND_ON");
            m.SetFloat("_FlipbookMode", 0f);
            m.SetColor("_Color", Color.white);
            m.SetTexture("_MainTex", tex);
            m.renderQueue = (int)RenderQueue.Transparent;

            AssetDatabase.CreateAsset(m, path);
            return m;
        }

        // ================================================================== textures

        static Texture2D BakeTexture(string kind, string dir, string name)
        {
            Func<float, float, float> mask;
            switch ((kind ?? "glow").ToLowerInvariant())
            {
                case "sparkle": mask = Sparkle; break;
                case "cloud": mask = Cloud; break;
                case "disc": mask = Disc; break;
                case "ring": mask = Ring; break;
                case "trail": mask = Trail; break;
                default: mask = Glow; break;
            }

            var pixels = new Color[TexSize * TexSize];
            for (int y = 0; y < TexSize; y++)
                for (int x = 0; x < TexSize; x++)
                {
                    float u = (x + 0.5f) / TexSize * 2f - 1f;
                    float v = (y + 0.5f) / TexSize * 2f - 1f;
                    float a = Mathf.Clamp01(mask(u, v));
                    pixels[y * TexSize + x] = new Color(1f, 1f, 1f, a);
                }

            var t = new Texture2D(TexSize, TexSize, TextureFormat.RGBA32, false);
            t.SetPixels(pixels);
            t.Apply();
            string path = dir + "/T_" + name + ".png";
            File.WriteAllBytes(path, t.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(t);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);

            var imp = (TextureImporter)AssetImporter.GetAtPath(path);
            imp.textureType = TextureImporterType.Default;
            imp.alphaIsTransparency = true;
            imp.wrapMode = TextureWrapMode.Clamp;
            imp.mipmapEnabled = false;
            imp.maxTextureSize = 256;
            imp.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        static float Glow(float x, float y) { float r = Mathf.Sqrt(x * x + y * y); return Mathf.Pow(Mathf.Clamp01(1f - r), 2f); }

        static float Sparkle(float x, float y)
        {
            float r = Mathf.Sqrt(x * x + y * y);
            float core = Mathf.Exp(-r * 8f);
            float rays = Mathf.Exp(-Mathf.Abs(x) * 40f) * Mathf.Clamp01(1f - Mathf.Abs(y)) * 0.6f
                       + Mathf.Exp(-Mathf.Abs(y) * 40f) * Mathf.Clamp01(1f - Mathf.Abs(x)) * 0.6f;
            return core + rays;
        }

        static float Cloud(float x, float y)
        {
            float r = Mathf.Sqrt(x * x + y * y);
            float n = Mathf.PerlinNoise(x * 2.5f + 3.1f, y * 2.5f + 1.7f);
            return Mathf.Clamp01(1f - r) * (0.4f + 0.6f * n);
        }

        static float Disc(float x, float y)
        {
            float r = Mathf.Sqrt(x * x + y * y);
            float th = Mathf.Atan2(y, x);
            float arms = 0.5f + 0.5f * Mathf.Sin(3f * th + 8f * r);
            return Mathf.Pow(Mathf.Clamp01(1f - r), 1.5f) * arms;
        }

        static float Ring(float x, float y)
        {
            float r = Mathf.Sqrt(x * x + y * y);
            float d = (r - 0.7f) / 0.08f;
            return Mathf.Exp(-d * d);
        }

        static float Trail(float x, float y)
        {
            return Mathf.Clamp01(1f - Mathf.Abs(y)) * Mathf.Clamp01((x + 1f) * 0.5f);
        }

        // ================================================================== helpers

        static Vector3 V3(float[] a)
        {
            if (a == null || a.Length < 3) return Vector3.zero;
            return new Vector3(a[0], a[1], a[2]);
        }

        static Color C(float[] a)
        {
            if (a == null || a.Length < 3) return Color.white;
            return new Color(a[0], a[1], a[2], a.Length > 3 ? a[3] : 1f);
        }
    }
}
